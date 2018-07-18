/*
CLASS THAT INSTANTIATES MULTIPLE EXCHANGE OBJECTS AND CALLS THEIR
APIS CONCURRENTLY TO THEN RETURN THE VALUES IN A DICTIONARY SO FE
CAN DISPLAY COMBINED EXCHANGE INFORMATION
*/
const { emitter } = require('./Exchange');
const availableExchanges = require('../exchanges');


class ExchangeAggregator {

  constructor(exchanges) {
    console.log("What are exchanges: ", exchanges);
    this.subscriptions = {};
    this.exchanges = [];
    this.mergedOrderBook = {
      asks: null,
      bids: null
    };
    if (exchanges.length) {
      exchanges.forEach(exchangeName => {
        this.exchanges.push(exchangeName);
        const instantiatedExchange = new availableExchanges[exchangeName]();
        this.subscriptions[exchangeName] = instantiatedExchange;
      })
    }
    console.log("Exchange agg");
  }

  sendWebSocket(msg) {
      console.log("What is socket msg ", msg);
  }

  subscribeToOrderBooks(market, callback) {
    console.log("Subscribing callback");
    const boundCallback = callback.bind(this);
    this.exchanges.forEach(exchange => this.subscriptions[exchange].initOrderBook(market))
    emitter.on('ORDER_BOOK_INIT', (event) => { this.mergeOrderBooks(event, boundCallback) })
    emitter.on('ORDER_UPDATE', (event) => {
      this.updateOrderBook(event);
    });
    setInterval(() => {
      const orderBookEvent = {
        type: 'ORDER_BOOK_INIT',
        orderBook: this.mergedOrderBook
      }
      boundCallback(JSON.stringify(orderBookEvent));
    }, 1000)
  }

  removeAllSubscriptions() {
    this.exchanges.forEach(exchange => this.subscriptions[exchange].stopOrderBook())
  }

  mergeOrderBooks(event, callback) {
    if (this.mergedOrderBook.bids) {
      const allBids = {...event.bids, ...this.mergedOrderBook.bids};
      const allBidRates = Object.keys(allBids);
      const orderBids = allBidRates.sort((a, b) => {
        return allBids[b].rate - allBids[a].rate;
      });
      const bidBook = {};
      orderBids.forEach(bid => {
        bidBook[bid] = allBids[bid];
      })
      this.mergedOrderBook.bids = bidBook;
    } else {
      this.mergedOrderBook.bids = event.bids;
    };

    if (this.mergedOrderBook.asks) {
      const allAsks = {...event.asks, ...this.mergedOrderBook.asks};
      const allAskRates = Object.keys(allAsks);
      const orderAsks = allAskRates.sort((a, b) => {
        return allAsks[a].rate - allAsks[b].rate;
      });
      const askBook = {};
      orderAsks.forEach(ask => {
        askBook[ask] = allAsks[ask];
      })
      this.mergedOrderBook.asks = askBook;
    } else {
      this.mergedOrderBook.asks = event.asks;
    };

    const orderBookEvent = {
      type: 'ORDER_BOOK_INIT',
      orderBook: this.mergedOrderBook
    }

    callback(JSON.stringify(orderBookEvent));
  }

  // Will use this same logic in React. Provide both backend & frontend orderbook
  updateOrderBook(event) {

    let book = {};
    let type = '';
    if (event.type === 'BID_UPDATE') {
      type = 'bids';
      book = this.mergedOrderBook.bids;
    }
    if (event.type === 'ASK_UPDATE') {
      type = 'asks';
      book = this.mergedOrderBook.asks;
    }
    if (book) {
      if (!event.amount) {
        if (book[event.rateString]) {
          delete book[event.rateString];
        }
        this.mergedOrderBook[type] = book;
      } else if (book[event.rateString]) {
        let order = {
          exchange: event.exchange,
          rate: event.rate,
          amount: event.amount
        };
        book[event.rateString] = order;
        this.mergedOrderBook[type] = book;
      } else {
        let order = {
          exchange: event.exchange,
          rate: event.rate,
          amount: event.amount
        };
        book[event.rateString] = order;
        const sortedBook = Object.keys(book).sort((a, b) => {
          if (type === 'bids') {
            return book[b].rate - book[a].rate;
          }
          if (type === 'asks') {
            return book[a].rate - book[b].rate;
          }
        });
        const newBook = {};
        sortedBook.forEach(b => {
          newBook[b] = book[b];
        })
        this.mergedOrderBook[type] = newBook;
      }
    }
  }
}



module.exports = ExchangeAggregator;
