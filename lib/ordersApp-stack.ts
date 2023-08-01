import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as lambdaEventSource from 'aws-cdk-lib/aws-lambda-event-sources'

interface OrdersAppStackProps extends cdk.StackProps {
    productDdb: dynamodb.Table,
    eventsDdb: dynamodb.Table
}

export class OrdersAppStack extends cdk.Stack {

    readonly ordersHandler: lambdaNodeJS.NodejsFunction 
    readonly orderEventsFetchHandler: lambdaNodeJS.NodejsFunction
    
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

        // Order Events Layer
        const orderEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrderEventsLayerVersionArn')
        const orderEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrderEventsLayerVersionArn', orderEventsLayerArn)

        // Order Events Repository Layer
        const orderEventsRepositoryLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrderEventsRepositoryLayerVersionArn')
        const orderEventsRepositoryLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrderEventsRepositoryLayerVersionArn', orderEventsRepositoryLayerArn)


        // Products Layer
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        // Topic creation
        const ordersTopic = new sns.Topic(this, 'OrderEventsTopic', {
            displayName: 'Order events topic',
            topicName: 'order-events'
        })

        // Creating the orderHandler function
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
                ORDERS_DDB: ordersDynamodb.tableName,
                ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn
            },
            layers: [ordersLayer, productsLayer, ordersApiLayer, orderEventsLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })

        // Giving read and write permission on order table
        ordersDynamodb.grantReadWriteData(this.ordersHandler)

        // Giving read permission on products table
        props.productDdb.grantReadData(this.ordersHandler)
        
        // Giving publish permission to ordersHandler funtion
        ordersTopic.grantPublish(this.ordersHandler)

        // Creating EventsHandler function     
        const orderEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEventsFunction', {
            functionName: 'OrderEventsFunction',
            entry: 'lambda/orders/orderEventsFunction.ts',
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
            layers: [orderEventsLayer, orderEventsRepositoryLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })
        // Subscribe orderEventsHandler at ordersTopic
        ordersTopic.addSubscription(new subs.LambdaSubscription(orderEventsHandler))

        // Giving policy to EventHandler function
        const eventsDynamoDbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [props.eventsDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#order_*']
                }
            }
        })
        orderEventsHandler.addToRolePolicy(eventsDynamoDbPolicy)

        // Creating the billingHandler function
        const billingHandler = new lambdaNodeJS.NodejsFunction(this, 'BillingFunction', {
            functionName: 'BillingFunction',
            entry: 'lambda/orders/billingFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })
        // Subscribe billingHandler ar ordersTopic
        ordersTopic.addSubscription(new subs.LambdaSubscription(billingHandler, {
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED']
                })
            }
        }))

        // Create the queue Dead Letter Queue
        const orderEventsDlq = new sqs.Queue(this, 'OrderEventsDlq', {
            queueName: 'order-events-dlq',
            enforceSSL: false,
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            retentionPeriod: cdk.Duration.days(10)
        })

        // Create the Order Events Queue
        const orderEventsQueue = new sqs.Queue(this, 'OrderEventsQueue', {
            queueName: 'order-events',
            enforceSSL: false,
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            deadLetterQueue: {
                maxReceiveCount: 3,
                queue: orderEventsDlq
            }
        })
        // Subscribe the orderEventsQueue on ordersTopic SNS
        ordersTopic.addSubscription(new subs.SqsSubscription(orderEventsQueue, {
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED']
                })
            }
        }))

        // Create Order Emails Handler function
        const orderEmailsHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEmailsFunction', {
            functionName: 'OrderEmailsFunction',
            entry: 'lambda/orders/orderEmailsFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false,
            },
            layers: [orderEventsLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })
        // When a message arrives at orderEventsQueue Invoke orderEmailsHandler
        orderEmailsHandler.addEventSource(new lambdaEventSource.SqsEventSource(orderEventsQueue,{
            // Setting to wait for 5 messages to arrive
            batchSize: 5,
            enabled: true,
            maxBatchingWindow: cdk.Duration.minutes(1)
        }))
        // Give orderEmailsHandler permission to consume messages from orderEventsQueue
        orderEventsQueue.grantConsumeMessages(orderEmailsHandler)

        // Create the policy to send email
        const orderEmailSesPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*']
        })
        orderEmailsHandler.addToRolePolicy(orderEmailSesPolicy)

        this.orderEventsFetchHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEventsFetchFunction', {
            functionName: 'OrderEventsFetchFunction',
            entry: 'lambda/orders/orderEventsFetchFunction.ts',
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
            layers: [orderEventsRepositoryLayer],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0
        })
        const eventsFetchDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:Query'],
            resources: [`${props.eventsDdb.tableArn}/index/emailIndex`]
        })
        this.orderEventsFetchHandler.addToRolePolicy(eventsFetchDdbPolicy)
    }
}  