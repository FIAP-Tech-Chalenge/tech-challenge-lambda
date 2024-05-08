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

const { CognitoIdentityProviderClient, AdminInitiateAuthCommand, SignUpCommand, AdminGetUserCommand, AdminConfirmSignUpCommand  } = require("@aws-sdk/client-cognito-identity-provider");
const { Pool } = require('pg');

const userPoolId = process.env.UserPoolId || 'default_value';
const clientId = process.env.ClientId || 'default_value';
const region ="us-east-1";
const senhaPadrao = "Mudar#123"
const cognitoClient = new CognitoIdentityProviderClient({region: region});
const databasePool = new Pool({
    host: process.env.Host || 'default_value',
    port: process.env.Port || 'default_value',
    user: process.env.User || 'default_value',
    password: process.env.DatabasePassword || 'default_value',
    database: process.env.DatabaseName || 'default_value',
    ssl: true
});

module.exports.lambdaHandler = async (event, context) => {

    const [cpf, email] = validaDadosDeEntrada(event)
    try {
        if(await cpfExisteNoBancoDeDadosDaAplicacao(cpf, email)) {
            if(await usuarioCadastradoCognito(email)) {
                return await autenticaUsuarioCognito(email)
            }else{
                await cadastraUsuarioNoUserPool(email)
                return await autenticaUsuarioCognito(email)
            }
        }else {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "AWS Lambda: CPF inexistente no banco da aplicação" }),
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};


const validaDadosDeEntrada = (event) => {
    if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "AWS Lambda: O corpo da requisição esta vazio" }),
        };
    }
    try {
        const {cpf, email} = JSON.parse(event.body)
        if(!((cpf && cpf != "") && (email && email != ""))) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "AWS Lambda: Dados de entrada invalidos" }),
            };
        }
        return [cpf, email]
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "AWS Lambda: Falha ao extrair corpo da requisição" }),
        };
    }
}

const cpfExisteNoBancoDeDadosDaAplicacao = async (cpf, email) => {
    try {
        const client = await databasePool.connect();
        const response = await client.query(`selectss * from clientes c where c.cpf = '${cpf}' and c.email = '${email}'`);
        return response.rows.length == 1
    } catch (error) {
        throw new Error("DATABASE: Falha ao realizar busca no banco de dados")
      } finally {
        console.log("finaly sendo");
      }
}

const usuarioCadastradoCognito = async (email) => {
    try {
        await cognitoClient.send(new AdminGetUserCommand({
            UserPoolId: userPoolId,
            Username: email,
        }));
        return true
    } catch (error) {
        return false
    }
};

const cadastraUsuarioNoUserPool = async (email) => {
    try{
        const signUpParams = {
            ClientId: clientId,
            Username: email,
            Password: senhaPadrao,
        };
    
        const signUpCommand = new SignUpCommand(signUpParams);
        await cognitoClient.send(signUpCommand);
        
        await cognitoClient.send(new AdminConfirmSignUpCommand({
            UserPoolId: userPoolId,
            Username: email,
        }));
    } catch (error) {
        throw new Error("AWS IAM: Falha ao cadastrar usuário")
    }
}

const autenticaUsuarioCognito = async (email) => {
    const authParams = {
        AuthFlow: "ADMIN_NO_SRP_AUTH",
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthParameters: {
            USERNAME: email,
            PASSWORD: senhaPadrao,
        },
    };

    const authCommand = new AdminInitiateAuthCommand(authParams);
    const authResult = await cognitoClient.send(authCommand);
    
    return {
        statusCode: 200,
        body: JSON.stringify({ token: authResult.AuthenticationResult.AccessToken}),
    };
}