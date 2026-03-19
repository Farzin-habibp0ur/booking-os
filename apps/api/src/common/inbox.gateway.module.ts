import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InboxGateway } from './inbox.gateway';
import { WebChatGateway } from './web-chat.gateway';
import { CustomerIdentityModule } from '../modules/customer-identity/customer-identity.module';
import { ConversationModule } from '../modules/conversation/conversation.module';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '15m') },
      }),
    }),
    CustomerIdentityModule,
    ConversationModule,
  ],
  providers: [InboxGateway, WebChatGateway],
  exports: [InboxGateway, WebChatGateway],
})
export class InboxGatewayModule {}
