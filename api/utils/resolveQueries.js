const mongoose = require('mongoose');

// Query factories preserve parallel reads normally, but serialize operations in a transaction.
module.exports = async function resolveQueries(factories) {
  if (!mongoose.transactionAsyncLocalStorage?.getStore()?.session) {
    return Promise.all(factories.map(factory => factory()));
  }
  const results = [];
  for (const factory of factories) results.push(await factory());
  return results;
};
