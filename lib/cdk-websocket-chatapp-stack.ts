import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class CdkChatAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. DynamoDB Table
    const table = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. Create the Lambda functions
    const makeLambda = (id: string, timeoutSec: number) => {
      return new lambda.Function(this, id, {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: `handler.lambda_handler`,
        code: lambda.Code.fromAsset(`lambda/${id}`),
        environment: { TABLE_NAME: table.tableName},
        timeout: cdk.Duration.seconds(timeoutSec),
        architecture: lambda.Architecture.ARM_64,
        functionName: `${this.stackName}-${id}`,
      });
    };

    const connectFn = makeLambda('connect', 10);
    const sendMessageFn = makeLambda('sendmessage', 10);
    const disconnectFn = makeLambda('disconnect', 10);
  

    // 4. IAM: Grant access to DynamoDB and API Gateway
    table.grantWriteData(connectFn);
    table.grantWriteData(disconnectFn);
    table.grantReadWriteData(sendMessageFn);

    sendMessageFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: ['*'], // can be narrowed to specific API ARN
    }));

    // 5. API Gateway WebSocket API
    const wsApi = new apigwv2.WebSocketApi(this, 'ChatApi', {
      apiName: 'chat-app-api',
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', connectFn),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', disconnectFn),
      },
    });

    wsApi.addRoute('sendmessage', {
      integration: new integrations.WebSocketLambdaIntegration('SendIntegration', sendMessageFn),
    });

    const stage = new apigwv2.WebSocketStage(this, 'ChatApiStage', {
      webSocketApi: wsApi,
      stageName: 'production',
      autoDeploy: true,
    });

    // 6. Lambda permissions for API Gateway to invoke
    [connectFn, disconnectFn, sendMessageFn].forEach(fn => {
      fn.addPermission(`${fn.node.id}InvokePermission`, {
        principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        action: 'lambda:InvokeFunction',
        sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.apiId}/${stage.stageName}/*/*`,
      });
    });


    // 7. Add CALLBACK_URL for send-message Lambda
    const apiDomain = `https://${wsApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`;
    sendMessageFn.addEnvironment('CALLBACK_URL', apiDomain);
  }

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkChatAppQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }




