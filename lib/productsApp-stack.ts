import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import * as iam from 'aws-cdk-lib/aws-iam'


interface ProductsAppStackProps extends cdk.StackProps {
    eventsDdb: dynamodb.Table
}

export class ProductsAppStack extends cdk.Stack {
    readonly productsFecthHandler: lambdaNodeJS.NodejsFunction
    readonly productsAdminHandler: lambdaNodeJS.NodejsFunction
    readonly productsDynamoDb: dynamodb.Table

    constructor(scope: Construct, id: string, props: ProductsAppStackProps) {
        super(scope, id, props)

        // DynamoDB table creation
        this.productsDynamoDb = new dynamodb.Table(this, 'ProductsDynamoDb', {
            tableName: 'Products',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        // Products layers
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        // Products events layers
        const productEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductEventsLayerVersionArn')
        const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductEventsLayerVersionArn', productEventsLayerArn)


        // productEventsHandler lambda creation
        const productEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductEventsFunction', {
            functionName: 'ProductsEventsHandler',
            entry: 'lambda/products/productEventsFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName
            },
            layers: [productEventsLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })

        // Giving policy to ProductEventsHandler function (PutItem)
        const eventsDynamoDbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [props.eventsDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#product_*']
                }
            }
        })
        productEventsHandler.addToRolePolicy(eventsDynamoDbPolicy)

        // ProductsFetchFunction lambda creation
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
            },
            layers: [productsLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })
        this.productsDynamoDb.grantReadData(this.productsFecthHandler)

         // ProductsAdminFunction lambda creation
        this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsAdminHandler', {
            functionName:  'ProductsAdminFunction',
            entry: 'lambda/products/productsAdminFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDynamoDb.tableName,
                PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName
            },
            layers: [productsLayer, productEventsLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })
        this.productsDynamoDb.grantWriteData(this.productsAdminHandler)
        productEventsHandler.grantInvoke(this.productsAdminHandler)
    }  
}