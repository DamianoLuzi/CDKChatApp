import { Stage,StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CdkChatAppStack } from "./cdk-websocket-chatapp-stack";

export class PipelineStage extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);

        const app = new CdkChatAppStack(this, 'CdkChatAppStack')
    }
}