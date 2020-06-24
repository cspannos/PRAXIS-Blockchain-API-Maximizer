var assert = require('assert');
var utils = require('../packages/web3-utils');

describe('lib/utils/utils', function () {
    describe('fromWei', function () {
        it('should return the correct value', function () {

            assert.equal(utils.fromWei('1000000000000000000', 'wei'),    '1000000000000000000');
            assert.equal(utils.fromWei('1000000000000000000', 'kwei'),   '1000000000000000');
            assert.equal(utils.fromWei('1000000000000000000', 'mwei'),   '1000000000000');
            assert.equal(utils.fromWei('1000000000000000000', 'gwei'),   '1000000000');
            assert.equal(utils.fromWei('1000000000000000000', 'szabo'),  '1000000');
            assert.equal(utils.fromWei('1000000000000000000', 'finney'), '1000');
            assert.equal(utils.fromWei('1000000000000000000', 'ether'),  '1');
            assert.equal(utils.fromWei('1000000000000000000', 'kether'), '0.001');
            assert.equal(utils.fromWei('1000000000000000000', 'grand'),  '0.001');
            assert.equal(utils.fromWei('1000000000000000000', 'mether'), '0.000001');
            assert.equal(utils.fromWei('1000000000000000000', 'gether'), '0.000000001');
            assert.equal(utils.fromWei('1000000000000000000', 'tether'), '0.000000000001');
        });

        it('should verify "number" arg is string or BN', function () {
            try {
                utils.fromWei(100000000000, 'wei')
                assert.fail();
            } catch (error) {
                assert(error.message.includes('Please pass numbers as strings or BN objects'))
            }
        })
        // fromWei always returns string
        it('should return the correct type', function(){
            var weiString = '100000000000000000';
            var weiBN = utils.toBN(weiString);

            assert(typeof utils.fromWei(weiString) === 'string');
            assert(typeof utils.fromWei(weiBN) === 'string');
        })
    });
});
