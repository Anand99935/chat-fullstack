module.exports = {
  apps: [
    {
      name: 'backend',           
      script: 'server.js',          
      watch: true,                 
      env: {                       // default environment variables (development)
        NODE_ENV: 'development',
        PORT: 5000,
        ACTUAL_ENVIRONMENT: 'development',
        MONGODB_URI: 'mongodb://chat-app:CMq6bcHK@ac-apdvg5x-shard-00-00.ramskda.mongodb.net:27017,ac-apdvg5x-shard-00-01.ramskda.mongodb.net:27017,ac-apdvg5x-shard-00-02.ramskda.mongodb.net:27017/chatDB?ssl=true&replicaSet=atlas-xxxx-shard-0&authSource=admin&retryWrites=true&w=majority'
      },
      env_production: {            // production environment variables
        NODE_ENV: 'production',
        PORT: 5000,
        ACTUAL_ENVIRONMENT: 'production',
        MONGODB_URI: 'mongodb://chat-app:CMq6bcHK@ac-apdvg5x-shard-00-00.ramskda.mongodb.net:27017,ac-apdvg5x-shard-00-01.ramskda.mongodb.net:27017,ac-apdvg5x-shard-00-02.ramskda.mongodb.net:27017/chatDB?ssl=true&replicaSet=atlas-xxxx-shard-0&authSource=admin&retryWrites=true&w=majority'
      }
    }
  ]
};
