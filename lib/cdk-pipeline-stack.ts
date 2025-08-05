import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { PipelineStage } from './pipeline-stage';

export class CdkPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this,"Pipeline", {
      pipelineName: 'ChatAppCodePipeline',
      synth: new ShellStep('Synth', {
        /* input: CodePipelineSource.gitHub(
          'DamianoLuzi/CDKChatApp','main'
        ), */
        input: CodePipelineSource.connection(
          'DamianoLuzi/CDKChatApp','main',{
            connectionArn: 'arn:aws:codeconnections:us-east-1:718579638605:connection/f3b44eaa-8aed-44d6-a0cf-b8186048d4e6',
          }
        ),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
      crossAccountKeys: false, // Set to true if you need cross-account deployments
    });
  
  pipeline.addStage(
    new PipelineStage(
      this, 'DEV', {env: { account: '718579638605', region: 'us-east-1' }})
  )
}
}




