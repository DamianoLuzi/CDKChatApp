import os
import boto3
import json

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("TABLE_NAME"))
apigw = boto3.client("apigatewaymanagementapi", endpoint_url=os.environ["CALLBACK_URL"])

def lambda_handler(event, context):

    body = json.loads(event["body"])
    message = body.get("message", "")

    # Get all active connections from DynamoDB
    connections = table.scan(ProjectionExpression="connectionId").get("Items", [])

    # Send the message to each connection
    for conn in connections:
        conn_id = conn.get('connectionId')
        if conn_id != event['requestContext']['connectionId']:
            try:
                apigw.post_to_connection(
                    ConnectionId=conn["connectionId"],
                    Data=message.encode("utf-8")
                )
            except apigw.exceptions.GoneException:
                # If stale, delete it
                table.delete_item(Key={"connectionId": conn["connectionId"]})
    return {
        "statusCode": 200,
        "body": "Message sent to all clients"
    }
