import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'

import * as dynamoDb from 'aws-cdk-lib/aws-dynamodb'

export class EventDdbStack extends cdk.Stack {
    readonly table: dynamoDb.Table

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        this.table = new dynamoDb.Table(this, 'EventsDdb', {
            tableName: 'events',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: 'pk',
                type: dynamoDb.AttributeType.STRING
            },
            sortKey: {
                name: 'sk',
                type: dynamoDb.AttributeType.STRING
            },
            timeToLiveAttribute: 'ttl',
            billingMode: dynamoDb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })
    }

    
}