import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { Construct } from 'constructs'

export class AuditEventsBus extends cdk.Stack {
    private readonly bus: events.EventBus

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        this.bus = new events.EventBus(this, 'AuditEventsBus', {
            eventBusName: 'AuditEventsBus'
        })

        this.bus.archive('BusArchive', {
            eventPattern: {
                source: ['app.order']
            },
            archiveName: 'auditeEvents',
            retention: cdk.Duration.days(10)
        })

        // source: app.order
    
        // detailType: order

        // Reason: PRODUCT_NOT_FOUND
        const nonValidOrderRule = new events.Rule(this, 'NonValidOrderRule', {
            ruleName: 'NonValidOrderRule',
            eventBus: this.bus,
            eventPattern: {
                source: ['app.order'],
                detailType: ['order'],
                detail: {
                    reason: ['PRODUCT_NOT_FOUND']
                }
            }
        })

        // Target
        const ordersErrorsFunction = new lambdaNodeJS.NodejsFunction(this, 'OrdersErrosFunction', {
            functionName: 'OrdersErrosFunction',
            entry: 'lambda/audit/ordersErrosFunction.ts',
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
        nonValidOrderRule.addTarget(new targets.LambdaFunction(ordersErrorsFunction))
    }
}
