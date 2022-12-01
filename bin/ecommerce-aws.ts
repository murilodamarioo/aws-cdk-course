#!/usr/bin/env node
import 'source-map-support/register'

import * as cdk from 'aws-cdk-lib'

import { ProductsAppStack } from '../lib'

import { EcommerceApiStack } from '../lib';

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

const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  tags: tags,
  env: env
})

// Add stack dependence to ecommerceApiStack
const ecommerceApiStack = new EcommerceApiStack(app, 'ECommerceApi', {
  productsFetchHandler: productsAppStack.productsFecthHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  tags: tags,
  env: env
})
ecommerceApiStack.addDependency(productsAppStack)