#!/usr/bin/env node
import 'source-map-support/register'

import * as cdk from 'aws-cdk-lib'

import { 
  ProductsAppStack, 
  EcommerceApiStack, 
  ProductAppLayersStack, 
  EventDdbStack 
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

const productsAppLayersStack = new ProductAppLayersStack(app, 'ProductsAppLayers', {
  tags: tags,
  env: env
})

const eventDdbStack = new EventDdbStack(app, 'EventsDdb', {
  tags: tags,
  env: env
})

const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  eventsDdb: eventDdbStack.table,
  tags: tags,
  env: env
})
productsAppStack.addDependency(productsAppLayersStack)
productsAppStack.addDependency(eventDdbStack)

// Add stack dependence to ecommerceApiStack
const ecommerceApiStack = new EcommerceApiStack(app, 'ECommerceApi', {
  productsFetchHandler: productsAppStack.productsFecthHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  tags: tags,
  env: env
})
ecommerceApiStack.addDependency(productsAppStack)