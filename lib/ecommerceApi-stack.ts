import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'

import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'

import * as apigateway from 'aws-cdk-lib/aws-apigateway'


interface EcommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction;
    productsAdminHandler: lambdaNodeJS.NodejsFunction;
    ordersHandler:  lambdaNodeJS.NodejsFunction;
}

export class EcommerceApiStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: EcommerceApiStackProps) {
        super(scope, id, props)

        const api = new apigateway.RestApi(this, 'ECommerceApi', {
            restApiName: 'ECommerceApi',
        })

        this.createProductService(props, api)

        this.createOrdersService(props, api)
    }

    private createOrdersService(props: EcommerceApiStackProps, api: apigateway.RestApi) {
        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

        // resource - "/orders"
        const ordersResource = api.root.addResource('orders')

        // GET - "/orders"
        // GET - "/orders?email={email}"
        // GET - "/orders?email={email}&orderId={orderId}"
        ordersResource.addMethod('GET', ordersIntegration)
        
        // DELETE - "/orders?email={email}&orderId={orderId}"
        const orderDeletionValidator = new apigateway.RequestValidator(this, 'OrderDeletionvalidator', {
            restApi: api,
            requestValidatorName: 'OrderDeletionvalidator',
            validateRequestParameters: true
        })

        ordersResource.addMethod('DELETE', ordersIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.orderId': true
            },
            requestValidator: orderDeletionValidator
        })

        // Build order request validator
        const orderRequestValidator = new apigateway.RequestValidator(this, 'OrderRequestValidator', {
            restApi: api,
            requestValidatorName: 'Order request validator',
            validateRequestBody: true
        })
    
        // Build order model
        const orderModel = new apigateway.Model(this, 'OrderModel', {
            modelName: 'OrderModel',
            restApi: api,
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    email: { type: apigateway.JsonSchemaType.STRING },
                    productIds: { 
                        type: apigateway.JsonSchemaType.ARRAY,
                        minItems: 1,
                        items: { type: apigateway.JsonSchemaType.STRING }
                    },
                    payment: { 
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ['CASH', 'DEBIT_CARD', 'CREDIT_CARD']
                    }
                },
                required: ['email', 'productIds', 'payment']
            }
        })
        // POST - "/orders"
        ordersResource.addMethod('POST', ordersIntegration, {
            requestValidator: orderRequestValidator,
            requestModels: {
                'application/json': orderModel
            }
        })
    }

    private createProductService(props: EcommerceApiStackProps, api: apigateway.RestApi) {
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

        // resource - "/products"
        const productsResource = api.root.addResource('products')

        // GET - "/products"
        productsResource.addMethod('GET', productsFetchIntegration)

        // GET - "/products/{id}"
        const productIdResource = productsResource.addResource('{id}')
        productIdResource.addMethod('GET', productsFetchIntegration)

        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        // POST - "/products"
        productsResource.addMethod('POST', productsAdminIntegration)

        // PUT - "/products/{id}"
        productIdResource.addMethod('PUT', productsAdminIntegration)

        // DELETE - "/products/{id}"
        productIdResource.addMethod('DELETE', productsAdminIntegration)
    }
}