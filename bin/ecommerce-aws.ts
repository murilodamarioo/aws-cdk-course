#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'

import { 
  ProductsAppStack, 
  EcommerceApiStack, 
  ProductAppLayersStack, 
  EventDdbStack,
  OrdersAppLayersStack,
  OrdersAppStack 
} from '../lib'

const app = new cdk.App();

// Defining acount and region where application will be available
const env: cdk.Environment = {
  account: '321404749782',
  region: 'us-east-2'
}

const tags = {
  cost: 'Ecommerce',
  team: 'Murilo'
}

// Product Layer Stack instance
const productsAppLayersStack = new ProductAppLayersStack(app, 'ProductsAppLayers', {
  tags: tags,
  env: env
})

// Event DynamoDB Stack instance
const eventsDdbStack = new EventDdbStack(app, 'EventsDdb', {
  tags: tags,
  env: env
})

// Product Stack instance
const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  eventsDdb: eventsDdbStack.table,
  tags: tags,
  env: env
})
// Add stack dependence to productAppStack
productsAppStack.addDependency(productsAppLayersStack)
productsAppStack.addDependency(eventsDdbStack)

// Order Layer Stack instance
const ordersAppLayerStack = new OrdersAppLayersStack(app, 'OrdersAppLayers', {
  tags: tags,
  env: env
})

// Order Stack instance
const ordersAppStack = new OrdersAppStack(app, 'OrdersApp', {
  tags: tags,
  env: env,
  productDdb: productsAppStack.productsDynamoDb,
  eventsDdb: eventsDdbStack.table
})
// Add stack dependence to orderAppStack
ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayerStack)
ordersAppStack.addDependency(eventsDdbStack)

// Ecommerce Stack instance
const ecommerceApiStack = new EcommerceApiStack(app, 'ECommerceApi', {
  productsFetchHandler: productsAppStack.productsFecthHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
  orderEventsFetchHandler: ordersAppStack.orderEventsFetchHandler,
  tags: tags,
  env: env
})
// Add stack dependence to ecommerceApiStack
ecommerceApiStack.addDependency(productsAppStack)
ecommerceApiStack.addDependency(ordersAppStack)
