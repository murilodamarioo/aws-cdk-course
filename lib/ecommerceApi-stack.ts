import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'

import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'

import * as apigateway from 'aws-cdk-lib/aws-apigateway'


interface EcommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction
    productsAdminHandler: lambdaNodeJS.NodejsFunction
}

export class EcommerceApiStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: EcommerceApiStackProps) {
        super(scope, id, props)

        const api = new apigateway.RestApi(this, 'ECommerceApi', {
            restApiName: 'ECommerceApi',
        })

        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

        // "/products"
        const productsResource = api.root.addResource('products')
        productsResource.addMethod('GET', productsFetchIntegration)

        // "/products/{id}"
        const productIdResource = productsResource.addResource('{id}')
        productIdResource.addMethod('GET', productsFetchIntegration)

        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        // "/products"
        productsResource.addMethod('POST', productsAdminIntegration)

        // "/products/{id}"
        productIdResource.addMethod('PUT', productsAdminIntegration)

        // "/products/{id}"
        productIdResource.addMethod('DELETE', productsAdminIntegration)
    }
}