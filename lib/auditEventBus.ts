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
            description: 'Rule matching non valid order',
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


        // source: app.invoice
    
        // detailType: invoice

        // ErrorDetail: FAIL_NO_INVOICE_NUMBER
        const nonValidInvoiceRule = new events.Rule(this, 'NonValidInvoiceRule', {
            ruleName: 'NonValidInvoiceRule',
            description: 'Rule matching non valid invoice',
            eventBus: this.bus,
            eventPattern: {
                source: ['app.invoice'],
                detailType: ['invoice'],
                detail: {
                    errorDetail: ['FAIL_NO_INVOICE_NUMBER']
                }
            }
        })

        // Target
        const invoicesErrorsFunction = new lambdaNodeJS.NodejsFunction(this, 'InvoicesErrosFunction', {
            functionName: 'InvoicesErrosFunction',
            entry: 'lambda/audit/invoicesErrosFunction.ts',
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
        nonValidInvoiceRule.addTarget(new targets.LambdaFunction(invoicesErrorsFunction))


        // source: app.invoice
    
        // detailType: invoice

        // ErrorDetail: TIMOUT
        const timeoutImportInvoiceRule = new events.Rule(this, 'TimeoutImportInvoiceRule', {
            ruleName: 'TimeoutImportInvoiceRule',
            description: 'Rule matching timout import invoice',
            eventBus: this.bus,
            eventPattern: {
                source: ['app.order'],
                detailType: ['order'],
                detail: {
                    reason: ['TIMEOUT']
                }
            }
        })

        // Target
        const invoiceImportTimoutQueue = new sqs.Queue(this, 'InvoiceImportTimout', {
            queueName: 'invoice-import-timout',
        })
        timeoutImportInvoiceRule.addTarget(new targets.SqsQueue(invoiceImportTimoutQueue))
    }
}
