import * as lambda from 'aws-cdk-lib/aws-lambda'

import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'

import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'

export class ProductsAppStack extends cdk.Stack {
    readonly productsFecthHandler: lambdaNodeJS.NodejsFunction

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)
        this.productsFecthHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsFecthFunction', {
            functionName: 'ProductsFecthFuntion',
            entry: 'lambda/products/productsFetchFunction.ts',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            bundling: {
                minify: true,
                sourceMap: false,
            }
        })
    }  
}