# Tendermint Bank Module Transaction Monitor

WebSocket client for monitoring Tendermint RPC bank module transactions, focusing on token transfers and sends.

## ⚠️ Important: Address Format Limitations

This tool only works with **NON-EOA wallets** given in hex format. The hex-to-bech32 conversion is a direct cast and will NOT work correctly with EOA (Externally Owned Account) wallets.

### Address Handling:
- ✅ Contract addresses: Can be converted between hex and bech32
- ❌ EOA wallets: Will NOT convert correctly - do not use hex address for EOA wallets

## Setup

```bash
npm install bech32
```

## Configuration

Create a `filters.json` file:
```json
{
  "recipients": [
    "0xCa35Df8FA9BD181aaF987B88E2f81649fc3A0C53",  // Contract address only
    "sei1wdfrkjffs4lrv8ezzrn2cvs65et5y09p9ljsq4"   // Native format
  ],
  "senders": []
}
```

- Supports both hex and bech32 formats for contract addresses only
- Empty sender array disables sender filtering
- Automatically converts hex addresses to bech32 (non-EOA only)

## Usage

```javascript
const client = new TendermintWSClient();
client.connect();
```

## Output

Provides filtered transaction data including:
- Senders
- Recipients/Receivers
- Amounts transferred

## Environment

Default RPC endpoint: `wss://rpc-testnet.sei-apis.com`
