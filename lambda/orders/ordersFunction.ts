import { Order, OrderRepository } from '/opt/nodejs/ordersLayer'

import { Product, ProductRepository } from '/opt/nodejs/productsLayer'

import { DynamoDB } from 'aws-sdk'

import * as AWSRay from 'aws-xray-sdk'

import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda'

import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from './layers/ordersLayer/nodejs/ordersApiLayer/nodejs/orderApi'

AWSRay.captureAWS(require('aws-cdk'))

const ordersDynamoDB = process.env.ORDERS_DDB!
const productsDynamoDb = process.env.PRODUCTS_DDB!

const dynamoDbClient = new DynamoDB.DocumentClient()

const orderRepository = new OrderRepository(dynamoDbClient, ordersDynamoDB)
const productRepository = new ProductRepository(dynamoDbClient, productsDynamoDb )


export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResultV2> {
    const method = event.httpMethod
    const apiRequestId = event.requestContext.requestId
    const lambdaRequestId = context.awsRequestId

    console.log(`API Gateway ResquestId: ${apiRequestId} - LambdaRequestId: ${lambdaRequestId}`)

    if(method === 'GET') {
        if (event.queryStringParameters) {
            const email = event.queryStringParameters!.email
            const orderId = event.queryStringParameters!.orderId

            if (email) {
                if(orderId) {
                    // Get one order from an user
                } else {
                    // Get all order from an user
                }
            }
        } else {
            // Get all orders
        }
    } else if (method === 'POST') {
        console.log('POST - /orders')

        const orderRequest = JSON.parse(event.body!) as OrderRequest
        const products = await productRepository.getProductsByIds(orderRequest.productIds)

        if (products.length === orderRequest.productIds.length) {
            const order = buildOrder(orderRequest, products)
            const orderCreated = await orderRepository.createOrder(order)

            return {
                statusCode: 201,
                body: JSON.stringify(convertToOrderResponse(orderCreated))
            }
        } else {
            return {
                statusCode: 404,
                body: 'Some product was not found'
            }
        }
    } else if (method === 'DELETE') {
        console.log('DELETE - /orders')

        const email = event.queryStringParameters!.email
        const orderId = event.queryStringParameters!.orderId
    }

    return {
        statusCode: 400,
        body: 'Bad Request'
    }
}

function convertToOrderResponse(order: Order): OrderResponse {
    const orderProducts: OrderProductResponse[] = []

    order.products.forEach((product) => {
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })
    
    const orderResponse: OrderResponse = {
        email: order.pk,
        id: order.sk!,
        createdAt: order.createdAt!,
        products: orderProducts,
        billing: {
            payment: order.billing.payment as PaymentType,
            totalPrice: order.billing.totalPrice
        },
        shipping: {
            type: order.shipping.type as ShippingType,
            carrier: order.shipping.carrier as CarrierType
        }
    }

    return orderResponse
}

function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {
    const orderProducts: OrderProductResponse[] = []
    let totalPrice: number = 0

    products.forEach((product) => {
        totalPrice += product.price
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })

    const order: Order = {
        pk: orderRequest.email,
        billing: {
            payment: orderRequest.paymentType,
            totalPrice: totalPrice
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProducts
    }

    return order
}