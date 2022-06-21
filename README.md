# Queue

![npm version](https://img.shields.io/npm/v/@plgworks/queue.svg?style=flat)

PLG Works Queue helps in publishing and subscribing tasks over [RabbitMQ](https://www.rabbitmq.com/). Internally it uses topic-based exchange.

One use-case is to publish tasks for asynchronous processing. For example, **API worker process** can publish tasks which will be taken up by **asynchronous worker processes** which have subscribed for such tasks.

## Prerequisites
- [RabbitMQ](https://www.rabbitmq.com/tutorials/amqp-concepts.html)

## Install

```bash
npm install @plgworks/queue --save
```

## Initialize
`configStrategy` is passed to initialize PLG Works Queue. `configStrategy` is an object with `rabbitmq` as a key. The value of `rabbitmq` is an object with following keys:
- **username** [string] (mandatory) RabbitMQ connection username
- **password** [string] (mandatory) RabbitMQ connection password
- **host** [string] (mandatory) RabbitMQ host
- **port** [string] (mandatory) RabbitMQ port
- **heartbeats** [string] (mandatory) [heartbeats](https://www.rabbitmq.com/heartbeats.html) defines after what period of time the peer TCP connection should be considered unreachable.
- **clusterNodes** [Array] (mandatory) - List of [RMQ cluster](https://www.rabbitmq.com/clustering.html#node-names) hosts.
- **enableRabbitmq** [integer] (optional) 0 if local usage.
- **switchHostAfterSec** [integer] (optional) Wait time before switching RMQ host.
- **connectionTimeoutSec** [integer] (optional) Wait time for connection to establish.

Following snippet initializes PLG Works Queue Manager:

```js
const Queue = require('@plgworks/queue');

// Config Strategy for PLG Works Queue.
configStrategy = {
	'rabbitmq': {
        'username': 'guest',
        'password': 'guest',
        'host': '127.0.0.1',
        'port': '5672',
        'heartbeats': '30',
        'enableRabbitmq': 1
    }
};

// Create instance
const queueManager = await Queue.getInstance(configStrategy);
```

## queueManager object methods
- `queueManager.subscribeEvent.rabbit(topics, options, readCallback, subscribeCallback)`
<br>Description: Subscribe to multiple topics over a queue.
<br>Parameters:
  - **topics** [Array] (mandatory) - Array of topics to subscribe to.
  - **options** [object] (mandatory) Object with following keys:
    - **queue** [string] (optional) - Name of the queue on which messages with relevant topics will be published. If not passed, a queue with a unique name is created and is deleted when the subscriber gets disconnected.
    - **ackRequired** [integer] (optional) - The delivered message needs ack if passed 1 ( default 0 ). if 1 passed and ack not done, message will redeliver.
    - **broadcastSubscription** [integer] (optional) -  Set to 1, when queue needs to be subscribed to broadcasting events. Default 0.
    - **prefetch** [integer] (optional) - The number of messages released from queue in parallel. In case of ackRequired=1, queue will pause unless delivered messages are acknowledged. Default 1.
  - **readCallback** [function] (mandatory) - Callback method will be invoked whenever there is a new notification.
  - **subscribeCallback** [function] (optional) - Callback method to get consumerTag.

- `queueManager.publishEvent.perform(params)`
<br>Description: Publish event to topics.
<br>Parameters:
  - **params** [object] (mandatory) Object with following keys:
    - **topics** [Array] (mandatory) Array of topics to which message to be publish.
    - **broadcast** [integer] (optional) Set to 1 for broadcasting. Default 0.
    - **publishAfter** [integer] (optional) Delay in milli-seconds between publish and being available for consumption. Default 0.
    - **publisher** [string] (mandatory) Name of publisher
    - **message** [object] (mandatory) Object with following keys:
      - **kind** [string] (mandatory) Kind of the message.
      - **payload** [object] (mandatory) Payload to identify message and extra info.

## Examples

### Subscribe
Following snippet subscribes to specific topics over a queue.

```js
const Queue = require('@plgworks/queue');

// Config Strategy for PLG Works Queue.
configStrategy = {
	'rabbitmq': {
        'username': 'guest',
        'password': 'guest',
        'host': '127.0.0.1',
        'port': '5672',
        'heartbeats': '30',
        'enableRabbitmq': 1
    }
};

let unAckCount = 0; // Number of unacknowledged messages.

const topics = ["topic.testTopic"];

const options = {
  queue: 'testQueue',
  ackRequired: 1, // When set to 1, all delivered messages MUST get acknowledge.
  broadcastSubscription: 1, // When set to 1, it will subscribe to broadcast channel and receive all broadcast messages. 
  prefetch:10
};

const processMessage = function(msgContent) {
  // Process message code here.
  // msgContent is the message string, which needs to be JSON parsed to get message object.
};

const readCallback = function(msgContent) {
  // Please make sure to return promise in callback function. 
  // On resolving the promise, the message will get acknowledged.
  // On rejecting the promise, the message will be re-queued (noAck)
  return new Promise(async function(onResolve, onReject) {
    // Incrementing unacknowledged message count.
    unAckCount++;

    // Process the message. Following is a 
    response = await processMessage(msgContent);
  
    // Complete the task and in the end of all tasks done
    if(response == success){
      // The message MUST be acknowledged here.
      // To acknowledge the message, call onResolve
      // Decrementing unacknowledged message count.
      unAckCount--;
      onResolve();   
    } else {
      //in case of failure to requeue same message.
      onReject();
    }
  })    
};

const subscription = {}; // object to store the consumer tag
const subscribeCallback = function(consumerTag) {
  subscription.consumerTag = consumerTag;
};

const subscribe = async function() {
  const queueManager = await Queue.getInstance(configStrategy);
  queueManager.subscribeEvent.rabbit(
    topics, // List of topics
    options,
    readCallback,
    subscribeCallback
   );
};

// Gracefully handle SIGINT, SIGTERM signals.
// Once SIGINT/SIGTERM signal is received, programme will stop consuming new messages. 
// But, the current process MUST handle unacknowledged queued messages.
process.on('SIGINT', function () {
  // Stop the consumption of messages
  process.emit('CANCEL_CONSUME', subscription.consumerTag);

  console.log('Received SIGINT, checking unAckCount.');
  const f = function(){
    if (unAckCount === 0) {
      process.exit(1);
    } else {
      console.log('waiting for open tasks to be done.');
      setTimeout(f, 1000);
    }
  };
  // Wait for open tasks to be done.
  setTimeout(f, 1000);
});

function rmqError(err) {
  console.log('rmqError occured.', err);
  process.emit('SIGINT');
}
// Event published from package in case of internal error.
process.on('rmq_error', rmqError);

subscribe();
```

### Publish

Following snippet publishes a task for specific topics.

```js
// Config Strategy for PLG Works Queue.
configStrategy = {
	'rabbitmq': {
        'username': 'guest',
        'password': 'guest',
        'host': '127.0.0.1',
        'port': '5672',
        'heartbeats': '30',
        'enableRabbitmq': 1
    }
};

const topics = ["topic.testTopic"];

const message = {
   kind: 'testMessageKind',
   payload: {
      // Custom payload for message
   }
};

// Import the Queue module.
const Queue = require('@plgworks/queue');
const publish = async function() {
  const queueManager = await Queue.getInstance(configStrategy);
  queueManager.publishEvent.perform(
    {
      topics: topics,
      publisher: 'MyPublisher',
      publishAfter: 30*1000, // delay in milli-seconds
      message: message
    });
};

publish();
```

### Publish with delay

In some use cases, it is required to process certain task with a delay. For example, after one hour of user sign-up, we need to send an email.
Such tasks can be published by using the `publishAfter` parameter. Internally, we use [dead letter exchange](https://www.rabbitmq.com/dlx.html) for achieving this functionality.

**Important Note**: Do not use arbitrary values of delays. Internally, the message is stored in a delay specific queue for the waiting duration. As the number of allowed delays increases, so do the number of waiting queues. Having too many queues, can hamper RabbitMQ performance.

```js
// Config Strategy for PLG Works Queue.
configStrategy = {
	'rabbitmq': {
        'username': 'guest',
        'password': 'guest',
        'host': '127.0.0.1',
        'port': '5672',
        'heartbeats': '30',
        'enableRabbitmq': 1
    }
};

const topics = ["topic.testTopic"];

const message = {
   kind: 'testMessageKind',
   payload: {
      // Custom payload for message
   }
};

// Import the Queue module.
const Queue = require('@plgworks/queue');
const publish = async function() {
  const queueManager = await Queue.getInstance(configStrategy);
  queueManager.publishEvent.perform(
    {
      topics: topics,
      publisher: 'MyPublisher',
      message: message
    });
};

publish();
```

### Cancel and Resume message consumption

As seen in the subscribe snippet, cancelling consumption is the first step in SIGINT handling. For cancelling the consumption,
consumerTag is needed, which is obtained in subscribeCallback. See subscribe snippet above for more details.

For cancelling the consumption, emit `CANCEL_CONSUME` event with consumerTag info.
```js
process.emit('CANCEL_CONSUME', consumerTag);
```

For resuming the consumption, emit `RESUME_CONSUME` event with consumerTag info.
```js
process.emit('RESUME_CONSUME', consumerTag);
```

## Running test cases
Run following command to execute test cases.
```shell script
./node_modules/.bin/mocha --recursive "./test/**/*.js"
```
