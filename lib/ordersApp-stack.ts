import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'

interface OrdersAppStackProps extends cdk.StackProps {
    productDdb: dynamodb.Table
}

export class OrdersAppStack extends cdk.Stack {

    readonly ordersHandler: lambdaNodeJS.NodejsFunction 
    
    constructor(scope: Construct, id: string, props: OrdersAppStackProps) {
        super(scope, id, props)

        // Order table creation
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

        // Orders API Layer
        const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn')
        const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn', ordersApiLayerArn)


        // Products Layer
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        // Creating the order function
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
            layers: [ordersLayer, productsLayer, ordersApiLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })

        // Giving read and write permission on order table
        ordersDynamodb.grantReadWriteData(this.ordersHandler)

        // Giving read permission on products table
        props.productDdb.grantReadData(this.ordersHandler)
    }
}