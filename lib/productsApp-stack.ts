import * as lambda from 'aws-cdk-lib/aws-lambda'

import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'

import * as cdk from 'aws-cdk-lib'

import * as dynamoDb from 'aws-cdk-lib/aws-dynamodb'

import { Construct } from 'constructs'

export class ProductsAppStack extends cdk.Stack {
    readonly productsFecthHandler: lambdaNodeJS.NodejsFunction
    readonly productsDynamoDb: dynamoDb.Table

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        // DynamoDB table creation
        this.productsDynamoDb = new dynamoDb.Table(this, 'ProductsDynamoDb', {
            tableName: 'Products',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: 'id',
                type: dynamoDb.AttributeType.STRING
            },
            billingMode: dynamoDb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        // Lambda creation
        this.productsFecthHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsFecthFunction', {
            functionName: 'ProductsFecthFunction',
            entry: 'lambda/products/productsFetchFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB: this.productsDynamoDb.tableName
            }
        })

        this.productsDynamoDb.grantReadData(this.productsFecthHandler)
    }  
}