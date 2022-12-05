import * as lambda from 'aws-cdk-lib/aws-lambda'

import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'

import * as cdk from 'aws-cdk-lib'

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

import * as ssm from 'aws-cdk-lib/aws-ssm'

import { Construct } from 'constructs'

interface OrdersAppStack extends cdk.StackProps {
    productDdb: dynamodb.Table
}

export class OrderAppStack extends cdk.Stack {

    readonly ordersHandler: lambdaNodeJS.NodejsFunction 
    
    constructor(scope: Construct, id: string, props: OrdersAppStack) {
        super(scope, id, props)

        // Criação da tabela de pedidos
        const ordersDynamodb = new dynamodb.Table(this, 'OrdersDdb', {
            tableName: 'orders',
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'sk',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        // Orders Layer
        const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn')
        const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn', ordersLayerArn)


        // Products Layer
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, 'OrdersFunction', {
            functionName: 'OrdersFuntion',
            entry: 'lambda/orders/ordersFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB: props.productDdb.tableName,
                ORDERS_DDB: ordersDynamodb.tableName
            },
            layers: [ordersLayer, productsLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })

        // Dando permissão para leitura e escrita na tabela de pedidos 
        ordersDynamodb.grantReadWriteData(this.ordersHandler)

        // Dando permissão de leitura na tabela de produtos
        props.productDdb.grantReadData(this.ordersHandler)
    }
}