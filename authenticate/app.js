/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

const { InitiateAuthCommand, CognitoIdentityProviderClient, AdminInitiateAuthCommand, SignUpCommand } = require("@aws-sdk/client-cognito-identity-provider");

const userPoolId = process.env.USERPOOL_ID || 'default_value';
const clientId = process.env.CLIENT_ID || 'default_value';
const region = process.env.REGION || 'default_value';
const cognitoClient = new CognitoIdentityProviderClient({region: region});

module.exports.lambdaHandler = async (event, context) => {
    const cpf = event.cpf; // Obtenha o parâmetro CPF da requisição

    // if (!cpf) {
    //     return {
    //         statusCode: 400,
    //         body: JSON.stringify({ error: "CPF is required" }),
    //     };
    // }

    try {
        // Verifica se o usuário com esse CPF já existe no banco de dados
        const existeUsuarioNoBanco = true
        if (existeUsuarioNoBanco) {
            const authParams = {
                AuthFlow: "ADMIN_NO_SRP_AUTH",
                UserPoolId: userPoolId,
                ClientId: clientId,
                AuthParameters: {
                    USERNAME: cpf,
                    PASSWORD: cpf,
                },
            };

            const authCommand = new AdminInitiateAuthCommand(authParams);
            const authResult = await cognitoClient.send(authCommand);

            return {
                statusCode: 200,
                body: JSON.stringify({ token: authResult.AuthenticationResult.IdToken }),
            };
        } else {
            // Se o usuário não existir, cadastra Banco
            // Deopois cadastra no Cognito

            const signUpParams = {
                ClientId: clientId,
                Username: cpf,
                Password: cpf,
            };

            const signUpCommand = new SignUpCommand(signUpParams);
            await cognitoClient.send(signUpCommand);

            // Autentica o novo usuário
            const authParams = {
                AuthFlow: "ADMIN_NO_SRP_AUTH",
                UserPoolId: userPoolId,
                ClientId: clientId,
                AuthParameters: {
                    USERNAME: cpf,
                    PASSWORD: cpf,
                },
            };

            const authCommand = new AdminInitiateAuthCommand(authParams);
            const authResult = await cognitoClient.send(authCommand);

            return {
                statusCode: 200,
                body: JSON.stringify({ token: authResult.AuthenticationResult.IdToken }),
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
