import * as cdk from 'aws-cdk-lib'
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha'
import * as apigatewayv2_integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as  s3n from 'aws-cdk-lib/aws-s3-notifications'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as lambdaEventsSource from 'aws-cdk-lib/aws-lambda-event-sources'
import { Construct } from 'constructs'


interface InvoiceWSApiStackProps extends cdk.StackProps {
    eventsDdb: dynamodb.Table
}

export class InvoiceWSApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: InvoiceWSApiStackProps) {
        super(scope, id, props)

        // Invoice Transaction Layer
        const invoiceTransactionLayerArn = ssm.StringParameter.valueForStringParameter(this, 'InvoiceTransactionLayerVersionArn')
        const invoiceTransactionLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'InvoiceTransactionLayer', invoiceTransactionLayerArn)

        // Invoice Layer
        const invoiceLayerArn = ssm.StringParameter.valueForStringParameter(this, 'InvoiceRepositoryLayerVersionArn')
        const invoiceLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'InvoiceRepositoryLayer', invoiceLayerArn)

        // Invoice WebSocket API Layer
        const invoiceWSConnectionLayerArn = ssm.StringParameter.valueForStringParameter(this, 'InvoiceWSConnectionLayerVersionArn')
        const invoiceWSConnectionLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'InvoiceWSConnectionLayer', invoiceWSConnectionLayerArn)

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
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
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
            layers: [invoiceTransactionLayer, invoiceWSConnectionLayer],
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
            layers: [invoiceLayer, invoiceTransactionLayer, invoiceWSConnectionLayer],
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
        const cancelImportHandler = new lambdaNodeJS.NodejsFunction(this, 'CancelImportUrlFunction', {
            functionName: 'CancelImportUrlFunction',
            entry: 'lambda/invoices/cancelImportUrlFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            layers: [invoiceTransactionLayer, invoiceWSConnectionLayer],
            tracing: lambda.Tracing.ACTIVE,
            environment: {
                INVOICE_DDB: invoicesDdb.tableName,
                INVOICE_WSAPI_ENDPOINT: wsApiEndPoint
            }
        })
        // Create and give policy to cancelimportHandler for PutIItem in the table
        const invoicesDdbReadWriteTransactionPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:UpdateItem', 'dynamodb:GetItem'],
            resources: [invoicesDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#transaction']
                }
            }
        })
        cancelImportHandler.addToRolePolicy(invoicesDdbReadWriteTransactionPolicy)
        // Give the policy to cancelimportHandler for manage connections
        webSocketApi.grantManageConnections(cancelImportHandler)

        // WebSocket API routes
        webSocketApi.addRoute('getImportUrl', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('GetUrlHandler', getUrlHandler)
        })
        webSocketApi.addRoute('cancelImport', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('CancelImportHandler', cancelImportHandler)
        })

        const invoiceEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'InvoiceEventsFunction', {
            functionName: 'InvoiceEventsFunction',
            entry: 'lambda/invoices/invoiceEventsFunction.ts',
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
                EVENTS_DDB: props.eventsDdb.tableName,
                INVOICE_WSAPI_END_POINT: wsApiEndPoint
            },
            layers: [invoiceWSConnectionLayer]
        })

        // Giving policy to InvoiceEventsFunction
        const eventsDynamoDbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [props.eventsDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#invoice_*']
                }
            }
        })
        invoiceEventsHandler.addToRolePolicy(eventsDynamoDbPolicy)
        webSocketApi.grantManageConnections(invoiceEventsHandler)
        
        const invoiceEventsDlq = new sqs.Queue(this, 'InvoiceEventsDlq', {
            queueName: 'invoice-events-dlq'
        })

        invoiceEventsHandler.addEventSource(new lambdaEventsSource.DynamoEventSource(invoicesDdb, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 5,
            bisectBatchOnError: true,
            onFailure: new lambdaEventsSource.SqsDlq(invoiceEventsDlq),
            retryAttempts: 3
        }))
    }
}