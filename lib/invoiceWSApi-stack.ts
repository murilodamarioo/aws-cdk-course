import * as cdk from 'aws-cdk-lib'
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha'
import * as apigatewayv2_integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as  s3n from 'aws-cdk-lib/aws-s3-notifications'
import { Construct } from 'constructs'

export class InvoiceWSApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        // Invoice and Invoice Transaction DDB
        const invoicesDdb = new dynamodb.Table(this, 'InvoicesDdb', {
            tableName: 'invoices',
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'sk',
                type: dynamodb.AttributeType.STRING
            },
            timeToLiveAttribute:'ttl',
            removalPolicy: cdk.RemovalPolicy.DESTROY
        })

        // Invoice bucket
        const bucket = new s3.Bucket(this, 'InvoicesBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [
                {
                    enabled: true,
                    expiration: cdk.Duration.days(1)
                }
            ]
        })

        // WebSocket connection handler
        const connectionHandler = new lambdaNodeJS.NodejsFunction(this, 'InvoiceConnectionFunction', {
            functionName: 'InvoiceConnectionFunction',
            entry: 'lambda/invoices/invoiceConnectionFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            tracing: lambda.Tracing.ACTIVE,
        })

        // WebSocket disconnection handler
        const disconnectionHandler = new lambdaNodeJS.NodejsFunction(this, 'InvoiceDisconnectionFunction', {
            functionName: 'InvoiceDisconnectionFunction',
            entry: 'lambda/invoices/invoiceDisconnectionFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            tracing: lambda.Tracing.ACTIVE,
        })

        // WebSocket API
        const webSocketApi = new apigatewayv2.WebSocketApi(this, 'InvoiceWSApi', {
            apiName: 'InvoiceWSApi',
            connectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ConnectionHandler', connectionHandler)
            },
            disconnectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DisconnectionHandler', disconnectionHandler)
            }
        })

        const stage = 'prod'
        const wsApiEndPoint = `${webSocketApi.apiEndpoint}/${stage}`
        new apigatewayv2.WebSocketStage(this, 'InvoiceWSApiStage', {
            webSocketApi: webSocketApi,
            stageName: stage,
            autoDeploy: true
        })

        // Invoice URL handler
        const getUrlHandler = new lambdaNodeJS.NodejsFunction(this, 'InvoiceGetUrlFunction', {
            functionName: 'InvoiceGetUrlFunction',
            entry: 'lambda/invoices/invoiceGetUrlFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            tracing: lambda.Tracing.ACTIVE,
            environment: {
                INVOICE_DDB: invoicesDdb.tableName,
                BUCKET_NAME: bucket.bucketName,
                INVOICE_WSAPI_ENDPOINT: wsApiEndPoint
            }
        })
        // Create and give policy to getUrlHandler for PutIItem in the table
        const invoicesDdbWriteTransactionPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [invoicesDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#transaction']
                }
            }
        })
        // Create and give policy to getUrlHandler for acess bucket
        getUrlHandler.addToRolePolicy(invoicesDdbWriteTransactionPolicy)
        const invoicesBucketPutObjectpolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:PutObject'],
            resources: [`${bucket.bucketArn}/*`]
        })
        getUrlHandler.addToRolePolicy(invoicesBucketPutObjectpolicy)
        // Give the policy to getUrlHandler for manage connections
        webSocketApi.grantManageConnections(getUrlHandler)

        // Invoice import handler
        const invoiceImportHandler = new lambdaNodeJS.NodejsFunction(this, 'InvoiceImportUrlFunction', {
            functionName: 'InvoiceImportUrlFunction',
            entry: 'lambda/invoices/invoiceImportUrlFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            tracing: lambda.Tracing.ACTIVE,
            environment: {
                INVOICE_DDB: invoicesDdb.tableName,
                INVOICE_WSAPI_ENDPOINT: wsApiEndPoint
            }
        })
        invoicesDdb.grantReadWriteData(invoiceImportHandler)

        bucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(invoiceImportHandler))

        // Create and give policy to invoicesBucketGetDeleteObjectPolicy
        const invoicesBucketGetDeleteObjectPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:DeleteObject', 's3:GetObject'],
            resources: [`${bucket.bucketArn}/*`]
        })
        invoiceImportHandler.addToRolePolicy(invoicesBucketGetDeleteObjectPolicy)
        // Give the policy to invoiceImportHandler for manage connections
        webSocketApi.grantManageConnections(invoiceImportHandler)

        // Cancel import handler


        // WebSocket API routes
    }
}