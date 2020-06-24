var chai = require('chai');
var assert = chai.assert;
var FakeIpcProvider = require('./helpers/FakeIpcProvider');
var FakeHttpProvider = require('./helpers/FakeHttpProvider');
var Web3 = require('../packages/web3');
var sha3 = require('../packages/web3-utils').sha3;
var formatters = require('web3-core-helpers').formatters;
var abiCoder = require('web3-eth-abi');
var utils = require('web3-utils');
var namehash = require('eth-ens-namehash');
var asciiToHex = require('../packages/web3-utils').asciiToHex;

/**
 * Injects the required validations and results for the `eth_sendTransaction` call
 *
 * @method prepareProviderForSetter
 *
 * @param {FakeIpcProvider} provider
 * @param {String} signature
 * @param {Array} types
 * @param {Array} params
 * @param {Boolean} error
 *
 * @returns {void}
 */
function prepareProviderForSetter(provider, signature, types, params, error) {
    provider.injectValidation(function (payload) {
        assert.equal(payload.jsonrpc, '2.0');
        assert.equal(payload.method, 'eth_sendTransaction');
        assert.deepEqual(
            payload.params,
            [{
                from: '0x0123456701234567012345670123456701234567',
                gas: '0x64',
                gasPrice: '0x64',
                nonce: '0x1',
                data: sha3(signature).slice(0, 10) + abiCoder.encodeParameters(types, params).substr(2),
                to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e'
            }]
        );
    });
    provider.injectResult('0x1234000000000000000000000000000000000000000000000000000000056789');

    provider.injectValidation(function (payload) {
        assert.equal(payload.method, 'eth_getTransactionReceipt');
        assert.deepEqual(payload.params, ['0x1234000000000000000000000000000000000000000000000000000000056789']);
    });
    provider.injectResult(null);

    provider.injectValidation(function (payload) {
        assert.equal(payload.method, 'eth_subscribe');
        assert.deepEqual(payload.params, ['newHeads']);
    });
    provider.injectResult('0x1234567');

    // fake newBlock
    provider.injectNotification({
        method: 'eth_subscription',
        params: {
            subscription: '0x1234567',
            result: {
                blockNumber: '0x10'
            }
        }
    });

    provider.injectValidation(function (payload) {
        assert.equal(payload.method, 'eth_getTransactionReceipt');
        assert.deepEqual(payload.params, ['0x1234000000000000000000000000000000000000000000000000000000056789']);
    });
    provider.injectResult({
        contractAddress: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
        cumulativeGasUsed: '0xa',
        transactionIndex: '0x3',
        blockNumber: '0xa',
        blockHash: '0xbf1234',
        gasUsed: '0x0',
        status: error ? '0x0' : '0x1'
    });
    provider.injectValidation(function (payload) {
        assert.equal(payload.method, 'eth_unsubscribe');
        assert.deepEqual(payload.params, ['0x1234567']);
    });
    provider.injectResult('0x321');
}

/**
 * Checks if the receipt got mapped as expected and not manipulated in a strange way within the ENS module
 *
 * @method isExpectedReceipt
 *
 * @param {Object} receipt
 *
 * @returns {void}
 */
function isExpectedReceipt(receipt) {
    assert.equal(receipt.contractAddress, '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e');
    assert.equal(receipt.cumulativeGasUsed, 10);
    assert.equal(receipt.transactionIndex, 3);
    assert.equal(receipt.blockNumber, 10);
    assert.equal(receipt.blockHash, '0xbf1234');
    assert.equal(receipt.gasUsed, 0);
}

describe('ens', function () {
    let provider;
    let web3;
    const hashedName = namehash.hash('foobar.eth');
    const name = 'foobar.eth';

    describe('setters', function () {
        beforeEach(function () {
            provider = new FakeIpcProvider();
            web3 = new Web3(provider);

            provider.injectResult({
                timestamp: Math.floor(new Date() / 1000) - 60,
            });
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['latest', false]);
            });

            provider.injectResult(1);
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'net_version');
                assert.deepEqual(payload.params, []);
            });

            provider.injectResult({
                hash: '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
                blockNumber: '0x0'
            });

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['0x0', false]);
            });
        });

        it('should set the property "registryAddress" to "null" and not throw any error', function() {
            web3.eth.ens.registryAddress = null;

            assert.equal(web3.eth.ens.registryAddress, null);
        });

        it('should set the owner record for a name', async function () {
            const signature = 'setOwner(bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address'],
                [hashedName, '0x0123456701234567012345670123456701234567'],
                false
            );

            const receipt = await web3.eth.ens.setOwner(
                name,
                '0x0123456701234567012345670123456701234567',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should set the owner record for a name and throw the expected error (callback)', function (done) {
            const signature = 'setOwner(bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address'],
                [hashedName, '0x0123456701234567012345670123456701234567'],
                true
            );

            web3.eth.ens.setOwner(
                name,
                '0x0123456701234567012345670123456701234567',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                },
                function (error, result) {
                    assert(error.message.includes('Transaction has been reverted by the EVM'));
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should set the owner record for a name and throw the expected error (promise)', async function () {
            const signature = 'setOwner(bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address'],
                [hashedName, '0x0123456701234567012345670123456701234567'],
                true
            );

            try {
                await web3.eth.ens.setOwner(
                    name,
                    '0x0123456701234567012345670123456701234567',
                    {
                        from: '0x0123456701234567012345670123456701234567',
                        gas: 100,
                        gasPrice: 100,
                        nonce: 1
                    }
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('Transaction has been reverted by the EVM'));
            }
        });

        it('should set the record for a name', async function () {
            const signature = 'setRecord(bytes32,address,address,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address', 'address', 'uint64'],
                [
                    hashedName,
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000
                ],
                false
            );

            const receipt = await web3.eth.ens.setRecord(
                name,
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567',
                10000,
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should set the record for a name and throw the expected error (callback)', function (done) {
            const signature = 'setRecord(bytes32,address,address,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address', 'address', 'uint64'],
                [
                    hashedName,
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000
                ],
                true
            );

            web3.eth.ens.setRecord(
                name,
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567',
                10000,
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                },
                function (error, result) {
                    assert(error.message.includes('Transaction has been reverted by the EVM'));
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should set the record for a name and throw the expected error (promise)', async function () {
            const signature = 'setRecord(bytes32,address,address,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address', 'address', 'uint64'],
                [
                    hashedName,
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000
                ],
                true
            );

            try {
                await web3.eth.ens.setRecord(
                    name,
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000,
                    {
                        from: '0x0123456701234567012345670123456701234567',
                        gas: 100,
                        gasPrice: 100,
                        nonce: 1
                    }
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('Transaction has been reverted by the EVM'));
            }
        });

        it('should set the owner, resolver, and ttl for a name', async function () {
            const signature = 'setSubnodeRecord(bytes32,bytes32,address,address,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address', 'address', 'uint64'],
                [
                    hashedName,
                    utils.sha3('label'),
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000
                ],
                false
            );

            const receipt = await web3.eth.ens.setSubnodeRecord(
                name,
                'label',
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567',
                10000,
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should set the owner, resolver, and ttl for a name with already hashed label', async function () {
            const signature = 'setSubnodeRecord(bytes32,bytes32,address,address,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address', 'address', 'uint64'],
                [
                    hashedName,
                    utils.sha3('label'),
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000
                ],
                false
            );

            const receipt = await web3.eth.ens.setSubnodeRecord(
                name,
                utils.sha3('label'),
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567',
                10000,
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should set the owner, resolver, and ttl for a name and throw the expected error (callback)', function (done) {
            const signature = 'setSubnodeRecord(bytes32,bytes32,address,address,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address', 'address', 'uint64'],
                [
                    hashedName,
                    utils.sha3('label'),
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000
                ],
                true
            );

            web3.eth.ens.setSubnodeRecord(
                name,
                'label',
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567',
                10000,
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                },
                function (error, result) {
                    assert(error.message.includes('Transaction has been reverted by the EVM'));
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should set the owner, resolver, and ttl for a name and throw the expected error (promise)', async function () {
            const signature = 'setSubnodeRecord(bytes32,bytes32,address,address,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address', 'address', 'uint64'],
                [
                    hashedName,
                    utils.sha3('label'),
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000
                ],
                true
            );

            try {
                await web3.eth.ens.setSubnodeRecord(
                    name,
                    'label',
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567',
                    10000,
                    {
                        from: '0x0123456701234567012345670123456701234567',
                        gas: 100,
                        gasPrice: 100,
                        nonce: 1
                    }
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('Transaction has been reverted by the EVM'));
            }
        });

        it('should set an approval by the given operator', async function () {
            const signature = 'setApprovalForAll(address,bool)';

            prepareProviderForSetter(
                provider,
                signature,
                ['address', 'bool'],
                [
                    '0x0123456701234567012345670123456701234567',
                    true
                ],
                false
            );

            const receipt = await web3.eth.ens.setApprovalForAll(
                '0x0123456701234567012345670123456701234567',
                true,
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should set an approval by the given operator and throw the expected error (callback)', function (done) {
            const signature = 'setApprovalForAll(address,bool)';

            prepareProviderForSetter(
                provider,
                signature,
                ['address', 'bool'],
                [
                    '0x0123456701234567012345670123456701234567',
                    true
                ],
                true
            );

            web3.eth.ens.setApprovalForAll(
                '0x0123456701234567012345670123456701234567',
                true,
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                },
                function (error, result) {
                    assert(error.message.includes('Transaction has been reverted by the EVM'));
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should set an approval by the given operator and throw the expected error (promise)', async function () {
            const signature = 'setApprovalForAll(address,bool)';

            prepareProviderForSetter(
                provider,
                signature,
                ['address', 'bool'],
                [
                    '0x0123456701234567012345670123456701234567',
                    true
                ],
                true
            );

            try {
                await web3.eth.ens.setApprovalForAll(
                    '0x0123456701234567012345670123456701234567',
                    true,
                    {
                        from: '0x0123456701234567012345670123456701234567',
                        gas: 100,
                        gasPrice: 100,
                        nonce: 1
                    }
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('Transaction has been reverted by the EVM'));
            }
        });

        it('should set the owner, resolver, and TTL for an record', async function () {
            const signature = 'setResolver(bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address'],
                [hashedName, '0x0123456701234567012345670123456701234567'],
                false
            );

            const receipt = await web3.eth.ens.setResolver(
                name,
                '0x0123456701234567012345670123456701234567',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should set the owner, resolver, and TTL for an record and throw the expected error (callback)', function (done) {
            const signature = 'setResolver(bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address'],
                [hashedName, '0x0123456701234567012345670123456701234567'],
                true
            );

            web3.eth.ens.setResolver(
                name,
                '0x0123456701234567012345670123456701234567',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                },
                function (error, result) {
                    assert(error.message.includes('Transaction has been reverted by the EVM'));
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should set the owner, resolver, and TTL for an record and throw the expected error (promise)', async function () {
            const signature = 'setResolver(bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'address'],
                [hashedName, '0x0123456701234567012345670123456701234567'],
                true
            );

            try {
                await web3.eth.ens.setResolver(
                    name,
                    '0x0123456701234567012345670123456701234567',
                    {
                        from: '0x0123456701234567012345670123456701234567',
                        gas: 100,
                        gasPrice: 100,
                        nonce: 1
                    }
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('Transaction has been reverted by the EVM'));
            }
        });

        it('should set the TTL (caching time) record for a name', async function () {
            const signature = 'setTTL(bytes32,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'uint64'],
                [hashedName, '1'],
                false
            );

            const receipt = await web3.eth.ens.setTTL(
                name,
                '1',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should call the TTL (caching time) record setter for a name and throw the expected error (callback)', function (done) {
            const signature = 'setTTL(bytes32,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'uint64'],
                [hashedName, '1'],
                true
            );

            web3.eth.ens.setTTL(
                name,
                '1',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                },
                function (error, result) {
                    assert(error.message.includes('Transaction has been reverted by the EVM'));
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should call the TTL (caching time) record setter for a name and throw the expected error (promise)', async function () {
            const signature = 'setTTL(bytes32,uint64)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'uint64'],
                [hashedName, '1'],
                true
            );

            try {
                await web3.eth.ens.setTTL(
                    name,
                    '1',
                    {
                        from: '0x0123456701234567012345670123456701234567',
                        gas: 100,
                        gasPrice: 100,
                        nonce: 1
                    }
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('Transaction has been reverted by the EVM'));
            }
        });

        it('should create a new sub node with the specified label and owner', async function () {
            const signature = 'setSubnodeOwner(bytes32,bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address'],
                [hashedName, utils.sha3('label'), '0x0123456701234567012345670123456701234567'],
                false
            );

            const receipt = await web3.eth.ens.setSubnodeOwner(
                name,
                'label',
                '0x0123456701234567012345670123456701234567',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should create a new sub node with the specified hashed label and owner', async function () {
            const signature = 'setSubnodeOwner(bytes32,bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address'],
                [hashedName, utils.sha3('label'), '0x0123456701234567012345670123456701234567'],
                false
            );

            const receipt = await web3.eth.ens.setSubnodeOwner(
                name,
                utils.sha3('label'),
                '0x0123456701234567012345670123456701234567',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                });

            isExpectedReceipt(receipt);
        });

        it('should create a new sub node with the specified label and owner and throw the expected error (callback)', function (done) {
            const signature = 'setSubnodeOwner(bytes32,bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address'],
                [hashedName, utils.sha3('label'), '0x0123456701234567012345670123456701234567'],
                true
            );

            web3.eth.ens.setSubnodeOwner(
                name,
                'label',
                '0x0123456701234567012345670123456701234567',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 100,
                    gasPrice: 100,
                    nonce: 1
                },
                function (error, result) {
                    assert(error.message.includes('Transaction has been reverted by the EVM'));
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should create a new sub node with the specified label and owner and throw the expected error (promise)', async function () {
            const signature = 'setSubnodeOwner(bytes32,bytes32,address)';

            prepareProviderForSetter(
                provider,
                signature,
                ['bytes32', 'bytes32', 'address'],
                [hashedName, utils.sha3('label'), '0x0123456701234567012345670123456701234567'],
                true
            );

            try {
                await web3.eth.ens.setSubnodeOwner(
                    name,
                    'label',
                    '0x0123456701234567012345670123456701234567',
                    {
                        from: '0x0123456701234567012345670123456701234567',
                        gas: 100,
                        gasPrice: 100,
                        nonce: 1
                    }
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('Transaction has been reverted by the EVM'));
            }
        });
    });

    describe('getters', function () {
        beforeEach(function () {
            provider = new FakeHttpProvider();
            web3 = new Web3(provider);

            provider.injectResult({
                timestamp: Math.floor(new Date() / 1000) - 60,
            });
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['latest', false]);
            });

            provider.injectResult(1);
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'net_version');
                assert.deepEqual(payload.params, []);
            });

            provider.injectResult({
                hash: '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
                blockNumber: '0x0'
            });

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['0x0', false]);
            });
        });

        it('should call supportsInterface with the interfaceId and return "true" (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const supportsInterfaceSignature = 'supportsInterface(bytes4)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(supportsInterfaceSignature).slice(0, 10) + sha3('addr(bytes32)').slice(2, 10) + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            const owner = await web3.eth.ens.supportsInterface('foobar.eth', '0x3b3b57de');

            assert.equal(owner, true);
        });

        it('should call supportsInterface with the interfaceId and return "true" (callback)', function (done) {
            const resolverSignature = 'resolver(bytes32)';
            const supportsInterfaceSignature = 'supportsInterface(bytes4)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(supportsInterfaceSignature).slice(0, 10) + sha3('addr(bytes32)').slice(2, 10) + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            web3.eth.ens.supportsInterface('foobar.eth', '0x3b3b57de', function (error, owner) {
                assert.equal(owner, true);

                done();
            });

        });

        it('should call supportsInterface with the signature and throw the expected error (callback)', function (done) {
            const resolverSignature = 'resolver(bytes32)';
            const supportsInterfaceSignature = 'supportsInterface(bytes4)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(supportsInterfaceSignature).slice(0, 10) + sha3('addr(bytes32)').slice(2, 10) + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.supportsInterface(
                'foobar.eth',
                'addr(bytes32)',
                function (error, supported) {
                    assert.equal(supported, null);
                    assert.equal(error.code, 1234);
                    assert.equal(error.message, 'ERROR');

                    done();
                });
        });

        it('should call supportsInterface with the signature and throw the expected error (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const supportsInterfaceSignature = 'supportsInterface(bytes4)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(supportsInterfaceSignature).slice(0, 10) + sha3('addr(bytes32)').slice(2, 10) + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.supportsInterface('foobar.eth', 'addr(bytes32)');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call getTTL and return the expected result (promise)', async function () {
            const signature = 'ttl(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            const ttl = await web3.eth.ens.getTTL('foobar.eth');

            assert.equal(ttl, 1);
        });

        it('should call getTTL and return the expected result (callback)', function (done) {
            const signature = 'ttl(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            web3.eth.ens.getTTL('foobar.eth', function (error, ttl) {
                assert.equal(ttl, 1);

                done();
            });

        });

        it('should call getTTL and throw the expected error (callback)', function (done) {
            const signature = 'ttl(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.getTTL(
                'foobar.eth',
                function (error, ttl) {
                    assert.equal(ttl, null);
                    assert.equal(error.code, 1234);
                    assert.equal(error.message, 'ERROR');

                    done();
                });
        });

        it('should call getTTL and throw the expected error (promise)', async function () {
            const signature = 'ttl(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.getTTL('foobar.eth');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call isApprovedForAll and return the expected result (promise)', async function () {
            const signature = 'isApprovedForAll(address,address)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '00000000000000000000000001234567012345670123456701234567012345670000000000000000000000000123456701234567012345670123456701234567',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            const isApproved = await web3.eth.ens.isApprovedForAll(
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567'
            );

            assert.equal(isApproved, true);
        });

        it('should call isApprovedForAll and return the expected result (callback)', function (done) {
            const signature = 'isApprovedForAll(address,address)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '00000000000000000000000001234567012345670123456701234567012345670000000000000000000000000123456701234567012345670123456701234567',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            web3.eth.ens.isApprovedForAll(
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567',
                function (error, isApproved) {
                    assert.equal(isApproved, true);

                    done();
                }
            );
        });

        it('should call isApprovedForAll and throws the expected error (callback)', function (done) {
            const signature = 'isApprovedForAll(address,address)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '00000000000000000000000001234567012345670123456701234567012345670000000000000000000000000123456701234567012345670123456701234567',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.isApprovedForAll(
                '0x0123456701234567012345670123456701234567',
                '0x0123456701234567012345670123456701234567',
                function (error, isApproved) {
                    assert.equal(isApproved, null);
                    assert.equal(error.code, 1234);
                    assert.equal(error.message, 'ERROR');

                    done();
                });
        });

        it('should call isApprovedForAll and throws the expected error (promise)', async function () {
            const signature = 'isApprovedForAll(address,address)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '00000000000000000000000001234567012345670123456701234567012345670000000000000000000000000123456701234567012345670',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.isApprovedForAll(
                    '0x0123456701234567012345670123456701234567',
                    '0x0123456701234567012345670123456701234567'
                );

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call recordExists and return the expected result (promise)', async function () {
            const signature = 'recordExists(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            const exists = await web3.eth.ens.recordExists(name);

            assert.equal(exists, true);
        });

        it('should call recordExists and return the expected result (callback)', function (done) {
            const signature = 'recordExists(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            web3.eth.ens.recordExists(
                name,
                function (error, exists) {
                    assert.equal(exists, true);

                    done();
                }
            );
        });

        it('should call recordExists and throws the expected error (callback)', function (done) {
            const signature = 'recordExists(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.recordExists(
                name,
                function (error, isApproved) {
                    assert.equal(isApproved, null);
                    assert.equal(error.code, 1234);
                    assert.equal(error.message, 'ERROR');

                    done();
                });
        });

        it('should call recordExists and throws the expected error (promise)', async function () {
            const signature = 'recordExists(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.recordExists(name);

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should return the owner record for a name (owner)', async function () {
            const signature = 'owner(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            const owner = await web3.eth.ens.registry.getOwner('foobar.eth');

            assert.equal(owner, '0x0123456701234567012345670123456701234567');
        });

        it('should call getOwner and return the expected owner (promise)', async function () {
            const signature = 'owner(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            const owner = await web3.eth.ens.getOwner('foobar.eth');

            assert.equal(owner, '0x0123456701234567012345670123456701234567');
        });

        it('should call getOwner and return the expected owner (callback)', function (done) {
            const signature = 'owner(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            web3.eth.ens.getOwner('foobar.eth', function (error, owner) {
                assert.equal(owner, '0x0123456701234567012345670123456701234567');
                assert.equal(error, '0x0123456701234567012345670123456701234567'); // For backward compatibility
                done();
            });
        });

        it('should call getOwner and throw the expected error (callback)', function (done) {
            const signature = 'owner(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.getOwner('foobar.eth', function (error, owner) {
                assert.equal(owner, null);
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');

                done();
            });
        });

        it('should call getOwner and throw the error on requesting of registry contract (callback)', function (done) {
            const signature = 'owner(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.getOwner('foobar.eth', function (error, owner) {
                assert.equal(owner, null);
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');

                done();
            });
        });

        it('should call getOwner and throw the error on requesting of registry contract (promise)', async function () {
            const signature = 'owner(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.getOwner('foobar.eth');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call resolver and return the expected resolver (promise)', async function () {
            const signature = 'resolver(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            const resolver = await web3.eth.ens.getResolver('foobar.eth');

            assert.equal(resolver.options.address, '0x0123456701234567012345670123456701234567');
        });

        it('should call resolver and return the expected resolver (callback)', function (done) {
            const signature = 'resolver(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            web3.eth.ens.getResolver('foobar.eth', function (error, resolver) {
                assert.equal(resolver.options.address, '0x0123456701234567012345670123456701234567');
                assert.equal(error.options.address, '0x0123456701234567012345670123456701234567'); // For backward compatibility

                done();
            });
        });

        it('should call getResolver and return the expected resolver (promise)', async function () {
            const signature = 'resolver(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            const resolver = await web3.eth.ens.getResolver('foobar.eth');

            assert.equal(resolver.options.address, '0x0123456701234567012345670123456701234567');
        });

        it('should call getResolver and throw the expected error (promise)', async function () {
            const signature = 'resolver(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.getResolver('foobar.eth');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call getResolver and throw the expected error on the contract registry call (promise)', async function () {
            const signature = 'resolver(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.getResolver('foobar.eth');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call getResolver and throw the expected error (callback)', function (done) {
            const signature = 'resolver(bytes32)';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(signature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });

            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.getResolver('foobar.eth', function (error, resolver) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
                assert.equal(resolver, null);

                done();
            });
        });

        it('should call getAddress and return the expected address (promise)', async function () {
            const resolverSig = 'resolver(bytes32)';
            const addrSig = 'addr(bytes32)';
            const addrInterfaceId = "3b3b57de";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + addrInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(addrSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000001234567012345670123456701234567012345670');

            const addr = await web3.eth.ens.getAddress('foobar.eth');

            assert.equal(addr, '0x1234567012345670123456701234567012345670');
        });

        it('should call getAddress and return the expected address (callback)', function (done) {
            const resolverSig = 'resolver(bytes32)';
            const addrSig = 'addr(bytes32)';
            const addrInterfaceId = "3b3b57de";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + addrInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(addrSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000001234567012345670123456701234567012345670');

            web3.eth.ens.getAddress('foobar.eth', function (error, addr) {
                assert.equal(error, '0x1234567012345670123456701234567012345670'); // For backward compatibility
                assert.equal(addr, '0x1234567012345670123456701234567012345670');

                done();
            });
        });

        it('should call getAddress and throw the expected error (promise)', async function () {
            const resolverSig = 'resolver(bytes32)';
            const addrSig = 'addr(bytes32)';
            const addrInterfaceId = "3b3b57de";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + addrInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(addrSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.getAddress('foobar.eth');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }

        });

        it('should call getAddress and throw the expected error (callback)', function (done) {
            const resolverSig = 'resolver(bytes32)';
            const addrSig = 'addr(bytes32)';
            const addrInterfaceId = "3b3b57de";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + addrInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(addrSig).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.getAddress('foobar.eth', function (error, addr) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
                assert.equal(addr, null);

                done();
            });
        });

        it('should call getPubkey and return the expected X and Y value (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const pubkeySignature = 'pubkey(bytes32)';
            const pubkeyInterfaceId = "c8690233";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + pubkeyInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(pubkeySignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            const pubkeyCoordinateAsHex = asciiToHex('0x0000000000000000000000000000000000000000000000000000000000000000');
            provider.injectResult([
                pubkeyCoordinateAsHex,
                pubkeyCoordinateAsHex
            ]);

            const result = await web3.eth.ens.getPubkey('foobar.eth');

            assert.equal(result[0][0], '0x3078303030303030303030303030303030303030303030303030303030303030');
            assert.equal(result[0][1], '0x3030303030303030303030303030303030303030303030303030303030303030');
        });

        it('should call getPubkey and return the expected X and Y value (callback)', function (done) {
            const resolverSignature = 'resolver(bytes32)';
            const pubkeySignature = 'pubkey(bytes32)';
            const pubkeyInterfaceId = "c8690233";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + pubkeyInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(pubkeySignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            const pubkeyCoordinateAsHex = asciiToHex('0x0000000000000000000000000000000000000000000000000000000000000000');
            provider.injectResult([
                pubkeyCoordinateAsHex,
                pubkeyCoordinateAsHex
            ]);

            web3.eth.ens.getPubkey(
                'foobar.eth',
                function (error, result) {
                    assert.equal(result[0][0], '0x3078303030303030303030303030303030303030303030303030303030303030');
                    assert.equal(result[0][1], '0x3030303030303030303030303030303030303030303030303030303030303030');
                    assert.equal(error[0][0], '0x3078303030303030303030303030303030303030303030303030303030303030');
                    assert.equal(error[0][1], '0x3030303030303030303030303030303030303030303030303030303030303030');

                    done();
                }
            );

        });

        it('should call getPubkey and throw the expected error (callback)', function (done) {
            const resolverSignature = 'resolver(bytes32)';
            const pubkeySignature = 'pubkey(bytes32)';
            const pubkeyInterfaceId = "c8690233";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + pubkeyInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(pubkeySignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            const pubkeyCoordinateAsHex = asciiToHex('0x0000000000000000000000000000000000000000000000000000000000000000');
            provider.injectResult([
                pubkeyCoordinateAsHex,
                pubkeyCoordinateAsHex
            ]);

            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.getPubkey(
                'foobar.eth',
                function (error, result) {
                    assert.equal(error.code, 1234);
                    assert.equal(error.message, 'ERROR');
                    assert.equal(result, null);

                    done();
                }
            );
        });

        it('should call getPubkey and throw the expected error (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const pubkeySignature = 'pubkey(bytes32)';
            const pubkeyInterfaceId = "c8690233";

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + pubkeyInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(pubkeySignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            const pubkeyCoordinateAsHex = asciiToHex('0x0000000000000000000000000000000000000000000000000000000000000000');
            provider.injectResult([
                pubkeyCoordinateAsHex,
                pubkeyCoordinateAsHex
            ]);

            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.getPubkey('foobar.eth');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call getContent and return the expected content of the resolver (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'content(bytes32)';
            const contentInterfaceId = 'd8389dc5';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contentInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(contentSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000000');

            const result = await web3.eth.ens.getContent('foobar.eth');

            assert.equal(result, '0x0000000000000000000000000000000000000000000000000000000000000000');
        });

        it('should call getContent and return the expected content of the resolver (callback)', function () {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'content(bytes32)';
            const contentInterfaceId = 'd8389dc5';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contentInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(contentSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000000');

            web3.eth.ens.getContent(
                'foobar.eth',
                function (error, result) {
                    assert.equal(result, '0x0000000000000000000000000000000000000000000000000000000000000000');
                    assert.equal(error, '0x0000000000000000000000000000000000000000000000000000000000000000');

                }
            );
        });

        it('should call getContent and throw the expected error (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'content(bytes32)';
            const contentInterfaceId = 'd8389dc5';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contentInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(contentSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            try {
                await web3.eth.ens.getContent('foobar.eth');

                assert.fail();
            } catch (error) {
                assert.equal(error.code, 1234);
                assert.equal(error.message, 'ERROR');
            }
        });

        it('should call getContent and throw the expected error (callback)', function () {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'content(bytes32)';
            const contentInterfaceId = 'd8389dc5';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contentInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000001');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(contentSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });

            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000000');

            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);
            provider.error.push(null);

            provider.injectError({
                code: 1234,
                message: 'ERROR'
            });

            web3.eth.ens.getContent(
                'foobar.eth',
                function (error, result) {
                    assert.equal(error.code, 1234);
                    assert.equal(error.message, 'ERROR');
                    assert.equal(result, null);
                }
            );
        });

        it('should error if resolver ABI does not support contenthash (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'contenthash(bytes32)';
            const contenthashInterfaceId = 'bc1c58d1';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contenthashInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000000');

            try {
                await web3.eth.ens.getContenthash('foobar.eth');

                assert.fail();
            } catch (error) {
                assert(error.message.includes('does not implement requested method: "contenthash"'));
            }
        });

        it('should error if resolver ABI does not support contenthash (callback)', function (done) {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'contenthash(bytes32)';
            const contenthashInterfaceId = 'bc1c58d1';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contenthashInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000000');

            web3.eth.ens.getContenthash(
                'foobar.eth',
                function (error, result) {
                    assert(error.message.includes('does not implement requested method: "contenthash"'));
                    assert.equal(result, null);
                    done();
                }
            );
        });

        it('should error if resolver ABI does not support setContenthash (promise)', async function () {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'setContenthash(bytes32)';
            const contenthashInterfaceId = 'bc1c58d1';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contenthashInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000000');

            try {
                await web3.eth.ens.setContenthash(
                    'foobar.eth',
                    'ipfs://QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
                );

                assert.fail();
            } catch (error) {
                assert(error.message.includes('does not implement requested method: "setContenthash"'));
            }
        });

        it('should error if resolver ABI does not support setContenthash (callback)', function (done) {
            const resolverSignature = 'resolver(bytes32)';
            const contentSignature = 'setContenthash(bytes32)';
            const contenthashInterfaceId = 'bc1c58d1';

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3(resolverSignature).slice(0, 10) + '1757b5941987904c18c7594de32c1726cda093fdddacb738cfbc4a7cd1ef4370',
                    to: '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000123456701234567012345670123456701234567');

            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_call');
                assert.deepEqual(payload.params, [{
                    data: sha3('supportsInterface(bytes4)').slice(0, 10) + contenthashInterfaceId + '00000000000000000000000000000000000000000000000000000000',
                    to: '0x0123456701234567012345670123456701234567',
                }, 'latest']);
            });
            provider.injectResult('0x0000000000000000000000000000000000000000000000000000000000000000');

            web3.eth.ens.setContenthash(
                'foobar.eth',
                'ipfs://QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn',
                {
                    from: '0x0123456701234567012345670123456701234567',
                    gas: 4000000,
                    gasPrice: 1
                },
                function (error, result) {
                    assert(error.message.includes('does not implement requested method: "setContenthash"'));
                    assert.equal(result, null);
                    done();
                }
            );
        });
    });

    describe('checkNetwork', function () {
        it("won't resolve on an unknown network", async function () {
            provider = new FakeHttpProvider();
            web3 = new Web3(provider);

            provider.injectResult({
                timestamp: Math.floor(new Date() / 1000) - 60,
            });
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['latest', false]);
            });

            provider.injectResult(1);
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'net_version');
                assert.deepEqual(payload.params, []);
            });

            provider.injectResult({
                hash: '0x0123456701234567012345670123456701234567012345670123456701234567',
                blockNumber: '0x0'
            });
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['0x0', false]);
            });

            try {
                await web3.eth.ens.getAddress('foobar.eth');
                assert.fail();
            } catch (err) {
                assert.isTrue(err instanceof Error, 'Should throw error');
            }
        });

        it("won't resolve when out of date", async function () {
            provider = new FakeHttpProvider();
            web3 = new Web3(provider);

            provider.injectResult({
                timestamp: Math.floor(new Date() / 1000) - 3660,
            });
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['latest', false]);
            });

            try {
                await web3.eth.ens.getAddress('foobar.eth');
                assert.fail();
            } catch (err) {
                assert.isTrue(err instanceof Error, 'Should throw error');
            }
        });

        it('should only check if the connected node is synced if at least a hour is gone', async function () {
            provider = new FakeHttpProvider();
            web3 = new Web3(provider);
            web3.eth.ens._lastSyncCheck = new Date() / 1000;

            try {
                await web3.eth.ens.checkNetwork();

                assert.fail();
            } catch (error) {
                return true;
            }
        });
    });

    describe('custom registry address', function () {
        let web3;
        let provider;
        const address = '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e';

        beforeEach(function () {
            provider = new FakeHttpProvider();

            // getBlock in checkNetwork
            provider.injectResult({
                timestamp: Math.floor(new Date() / 1000) - 60,
            });
            provider.injectValidation(function (payload) {
                assert.equal(payload.jsonrpc, '2.0');
                assert.equal(payload.method, 'eth_getBlockByNumber');
                assert.deepEqual(payload.params, ['latest', false]);
            });

            web3 = new Web3(provider);
            web3.eth.ens.registryAddress = address;
        });

        it('should use the custom defined registry address in checkNetwork', async function () {
            const currentRegistry = await web3.eth.ens.checkNetwork();

            assert.equal(currentRegistry, formatters.inputAddressFormatter(address));
            assert.equal(web3.eth.ens.registryAddress, formatters.inputAddressFormatter(address));
        });

        it('should keep the custom defined registry address if the provider changes', async function () {
            web3.eth.setProvider(provider);
            const currentRegistry = await web3.eth.ens.checkNetwork();

            assert.equal(currentRegistry, formatters.inputAddressFormatter(address));
            assert.equal(web3.eth.ens.registryAddress, formatters.inputAddressFormatter(address));
        });
    });
});
