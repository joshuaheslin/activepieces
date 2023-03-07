import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { webhookService } from "../webhooks/webhook-service";
import { appEventRoutingService } from "./app-event-routing.service";
import { engineHelper } from "../helper/engine-helper";
import { logger } from "../helper/logger";

export const appEventRoutingModule = async (app: FastifyInstance, _options: FastifyPluginOptions) => {
    app.register(appEventRoutingController, { prefix: "/v1/app-events" });
};

export const appEventRoutingController = async (fastify: FastifyInstance, options: FastifyPluginOptions) => {

    fastify.post(
        "/:pieceName",
        async (
            request: FastifyRequest<{
                Body: any;
                Params: {
                    pieceName: string;
                }
            }>,
            requestReply
        ) => {
            const pieceName = request.params.pieceName;
            const eventPayload = {
                headers: request.headers as Record<string, string>,
                body: request.body,
                method: request.method,
                queryParams: request.query as Record<string, string>,
            };
            const {reply, event, identifierValue} = await engineHelper.executeParseEvent({
                pieceName: pieceName,
                event: eventPayload
            });
      
            if (event && identifierValue) {
                const listeners = await appEventRoutingService.listListeners({
                    appName: pieceName,
                    event: event,
                    identifierValue: identifierValue
                })
                logger.info(`Found ${listeners.length} listeners for event ${event} with identifier ${identifierValue} in app ${pieceName}`);
                listeners.forEach(listener => {
                    webhookService.callback({
                        flowId: listener.flowId,
                        payload: eventPayload
                    });
                });
            }
            requestReply.status(200).headers(reply?.headers ?? {}).send(reply?.body?? {});
        }
    );

}