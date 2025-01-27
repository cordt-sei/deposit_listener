import { bech32 } from 'bech32';

const WS_URL = 'wss://rpc-testnet.sei-apis.com/websocket';
const filterFiles = {
  recipient: './config/recipients.json'
};

class TendermintWSClient {
  constructor(rpcEndpoint = WS_URL, filterFiles = {}) {
    this.wsEndpoint = rpcEndpoint;
    this.ws = null;
    this.filters = {};
    this.filterFiles = filterFiles;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.bech32Prefix = 'sei';
  }

  hexToBech32(hexAddress) {
    const cleanHex = hexAddress.replace('0x', '');
    const words = bech32.toWords(Buffer.from(cleanHex, 'hex'));
    return bech32.encode(this.bech32Prefix, words);
  }

  async loadFilters() {
    try {
      for (const [key, filePath] of Object.entries(this.filterFiles)) {
        const response = await fetch(filePath);
        const filterValues = await response.json();
        if (Array.isArray(filterValues)) {
          this.filters[key] = filterValues.map(addr =>
            addr.startsWith('0x') ? this.hexToBech32(addr) : addr
          );
        } else {
          throw new Error(`Filter file ${filePath} must contain an array`);
        }
      }
    } catch (error) {
      console.error('Error loading filters:', error);
      throw error;
    }
  }

  async connect() {
    await this.loadFilters();
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsEndpoint);
      this.ws.onopen = () => {
        this.subscribeToBankEvents();
        this.reconnectAttempts = 0;
        resolve();
      };
      this.ws.onclose = () => this.handleReconnect();
      this.ws.onerror = (error) => reject(error);
      this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 5000);
    }
  }

  subscribeToBankEvents() {
    const subscribeMsg = {
      jsonrpc: '2.0',
      method: 'subscribe',
      id: Date.now(),
      params: {
        query: "tm.event='Tx' AND message.module='bank'"
      }
    };
    this.ws.send(JSON.stringify(subscribeMsg));
  }

  decodeBase64(str) {
    return Buffer.from(str, 'base64').toString('utf-8');
  }

  extractTransferData(events) {
    const transferData = {
      senders: new Set(),
      receivers: new Set(),
      recipients: new Set(),
      spenders: new Set(),
      amounts: new Set()
    };

    events.forEach(event => {
      if (!event.attributes) return;

      event.attributes.forEach(attr => {
        const key = this.decodeBase64(attr.key);
        const value = this.decodeBase64(attr.value);

        switch(key) {
          case 'sender':
          case 'receiver':
          case 'recipient':
          case 'spender':
            transferData[key + 's'].add(value);
            break;
          case 'amount':
            transferData.amounts.add(value);
            break;
        }
      });
    });

    return {
      senders: [...transferData.senders],
      receivers: [...transferData.receivers],
      recipients: [...transferData.recipients],
      spenders: [...transferData.spenders],
      amounts: [...transferData.amounts]
    };
  }

  matchesFilters(events) {
    if (!this.filters || Object.keys(this.filters).length === 0) return true;

    return events.some(event => {
      if (!event.attributes) return false;

      return event.attributes.some(attr => {
        const key = this.decodeBase64(attr.key);
        const value = this.decodeBase64(attr.value);

        return Object.entries(this.filters).some(([filterKey, filterValues]) => {
          return (key === filterKey || (key === 'receiver' && filterKey === 'recipient')) &&
                 filterValues.includes(value);
        });
      });
    });
  }

  handleMessage(message) {
    if (!message.result?.data?.value?.TxResult?.result?.events) return;

    const events = message.result.data.value.TxResult.result.events;

    if (this.matchesFilters(events)) {
      const transferData = this.extractTransferData(events);
      console.log('Transfer:', transferData);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

const client = new TendermintWSClient();
client.connect()
  .catch(error => console.error('Connection error:', error));

process.on('SIGINT', () => {
  client.disconnect();
  process.exit();
});
