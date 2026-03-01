import {Contract} from 'trac-peer'

class SampleContract extends Contract {
    /**
     * Extending from Contract inherits its capabilities and allows you to define your own contract.
     * The contract supports the corresponding protocol. Both files come in pairs.
     *
     * Instances of this class run in contract context. The constructor is only called once on Peer
     * instantiation.
     *
     * Please avoid using the following in your contract functions:
     *
     * No try-catch
     * No throws
     * No random values
     * No http / api calls
     * No super complex, costly calculations
     * No massive storage of data.
     * Never, ever modify "this.op" or "this.value", only read from it and use safeClone to modify.
     * ... basically nothing that can lead to inconsistencies akin to Blockchain smart contracts.
     *
     * Running a contract on Trac gives you a lot of freedom, but it comes with additional responsibility.
     * Make sure to benchmark your contract performance before release.
     *
     * If you need to inject data from "outside", you can utilize the Feature class and create your own
     * oracles. Instances of Feature can be injected into the main Peer instance and enrich your contract.
     *
     * In the current version (Release 1), there is no inter-contract communication yet.
     * This means it's not suitable yet for token standards.
     * However, it's perfectly equipped for interoperability or standalone tasks.
     *
     * this.protocol: the peer's instance of the protocol managing contract concerns outside of its execution.
     * this.options: the option stack passed from Peer instance
     *
     * @param protocol
     * @param options
     */
    constructor(protocol, options = {}) {
        // calling super and passing all parameters is required.
        super(protocol, options);

        // simple function registration.
        // since this function does not expect value payload, no need to sanitize.
        // note that the function must match the type as set in Protocol.mapTxCommand()
        this.addFunction('storeSomething');

        // now we register the function with a schema to prevent malicious inputs.
        // the contract uses the schema generator "fastest-validator" and can be found on npmjs.org.
        //
        // Since this is the "value" as of Protocol.mapTxCommand(), we must take it full into account.
        // $$strict : true tells the validator for the object structure to be precise after "value".
        //
        // note that the function must match the type as set in Protocol.mapTxCommand()
        this.addSchema('submitSomething', {
            value : {
                $$strict : true,
                $$type: "object",
                op : { type : "string", min : 1, max: 128 },
                some_key : { type : "string", min : 1, max: 128 }
            }
        });

        // in preparation to add an external Feature (aka oracle), we add a loose schema to make sure
        // the Feature key is given properly. it's not required, but showcases that even these can be
        // sanitized.
        this.addSchema('feature_entry', {
            key : { type : "string", min : 1, max: 256 },
            value : { type : "any" }
        });

        // read helpers (no state writes)
        this.addFunction('readSnapshot');
        this.addFunction('readChatLast');
        this.addFunction('readTimer');
        this.addSchema('readKey', {
            value : {
                $$strict : true,
                $$type: "object",
                op : { type : "string", min : 1, max: 128 },
                key : { type : "string", min : 1, max: 256 }
            }
        });
        this.addSchema('createPoll', {
            value : {
                $$strict : true,
                $$type: "object",
                op : { type : "string", min : 1, max: 64 },
                poll_id : { type : "string", min : 1, max: 64 },
                question : { type : "string", min : 1, max: 256 },
                options : {
                    type : "array",
                    min : 2,
                    max : 10,
                    items : { type : "string", min : 1, max : 64 }
                }
            }
        });
        this.addSchema('castVote', {
            value : {
                $$strict : true,
                $$type: "object",
                op : { type : "string", min : 1, max: 64 },
                poll_id : { type : "string", min : 1, max: 64 },
                option : { type : "string", min : 1, max: 64 }
            }
        });
        this.addFunction('pollResults');

        // now we are registering the timer feature itself (see /features/time/ in package).
        // note the naming convention for the feature name <feature-name>_feature.
        // the feature name is given in app setup, when passing the feature classes.
        const _this = this;

        // this feature registers incoming data from the Feature and if the right key is given,
        // stores it into the smart contract storage.
        // the stored data can then be further used in regular contract functions.
        this.addFeature('timer_feature', async function(){
            if(false === _this.check.validateSchema('feature_entry', _this.op)) return;
            if(_this.op.key === 'currentTime') {
                if(null === await _this.get('currentTime')) console.log('timer started at', _this.op.value);
                await _this.put(_this.op.key, _this.op.value);
            }
        });

        // last but not least, you may intercept messages from the built-in
        // chat system, and perform actions similar to features to enrich your
        // contract. check the _this.op value after you enabled the chat system
        // and posted a few messages.
        this.messageHandler(async function(){
            if(_this.op?.type === 'msg' && typeof _this.op.msg === 'string'){
                const currentTime = await _this.get('currentTime');
                await _this.put('chat_last', {
                    msg: _this.op.msg,
                    address: _this.op.address ?? null,
                    at: currentTime ?? null
                });
            }
            console.log('message triggered contract', _this.op);
        });
    }

    /**
     * A simple contract function without values (=no parameters).
     *
     * Contract functions must be registered through either "this.addFunction" or "this.addSchema"
     * or it won't execute upon transactions. "this.addFunction" does not sanitize values, so it should be handled with
     * care or be used when no payload is to be expected.
     *
     * Schema is recommended to sanitize incoming data from the transaction payload.
     * The type of payload data depends on your protocol.
     *
     * This particular function does not expect any payload, so it's fine to be just registered using "this.addFunction".
     *
     * However, as you can see below, what it does is checking if an entry for key "something" exists already.
     * With the very first tx executing it, it will return "null" (default value of this.get if no value found).
     * From the 2nd tx onwards, it will print the previously stored value "there is something".
     *
     * It is recommended to check for null existence before using put to avoid duplicate content.
     *
     * As a rule of thumb, all "this.put()" should go at the end of function execution to avoid code security issues.
     *
     * Putting data is atomic, should a Peer with a contract interrupt, the put won't be executed.
     */
    async storeSomething(){
        const something = await this.get('something');

        console.log('is there already something?', something);

        if(null === something) {
            await this.put('something', 'there is something');
        }
    }

    /**
     * Now we are using the schema-validated function defined in the constructor.
     *
     * The function also showcases some of the handy features like safe functions
     * to prevent throws and safe bigint/decimal conversion.
     */
    async submitSomething(){
        // the value of some_key shouldn't be empty, let's check that
        if(this.value.some_key === ''){
            return new Error('Cannot be empty');
            // alternatively false for generic errors:
            // return false;
        }

        // of course the same works with assert (always use this.assert)
        this.assert(this.value.some_key !== '', new Error('Cannot be empty'));

        // btw, please use safeBigInt provided by the contract protocol's superclass
        // to calculate big integers:
        const bigint = this.protocol.safeBigInt("1000000000000000000");

        // making sure it didn't fail
        this.assert(bigint !== null);

        // you can also convert a bigint string into its decimal representation (as string)
        const decimal = this.protocol.fromBigIntString(bigint.toString(), 18);

        // and back into a bigint string
        const bigint_string = this.protocol.toBigIntString(decimal, 18);

        // let's clone the value
        const cloned = this.protocol.safeClone(this.value);

        // we want to pass the time from the timer feature.
        // since mmodifications of this.value is not allowed, add this to the clone instead for storing:
        cloned['timestamp'] = await this.get('currentTime');

        // making sure it didn't fail (be aware of false-positives if null is passed to safeClone)
        this.assert(cloned !== null);

        // and now let's stringify the cloned value
        const stringified = this.protocol.safeJsonStringify(cloned);

        // and, you guessed it, best is to assert against null once more
        this.assert(stringified !== null);

        // and guess we are parsing it back
        const parsed = this.protocol.safeJsonParse(stringified);

        // parsing the json is a bit different: instead of null, we check against undefined:
        this.assert(parsed !== undefined);

        // finally we are storing what address submitted the tx and what the value was
        await this.put('submitted_by/'+this.address, parsed.some_key);

        // printing into the terminal works, too of course:
        console.log('submitted by', this.address, parsed);
    }

    async createPoll(){
        this.assert(this.value?.op === 'create_poll', new Error('invalid op for createPoll'));

        const pollId = String(this.value.poll_id || '').trim();
        const question = String(this.value.question || '').trim();
        const optionsRaw = Array.isArray(this.value.options) ? this.value.options : [];
        this.assert(pollId !== '', new Error('poll_id is required'));
        this.assert(question !== '', new Error('question is required'));
        this.assert(optionsRaw.length >= 2, new Error('at least two options are required'));

        const options = [];
        for (const candidate of optionsRaw) {
            const option = String(candidate || '').trim();
            if (option === '') continue;
            if (options.includes(option) === false) options.push(option);
        }
        this.assert(options.length >= 2, new Error('at least two unique options are required'));

        const pollKey = `poll/${pollId}`;
        const existing = await this.get(pollKey);
        this.assert(existing === null, new Error('poll_id already exists'));

        const votes = {};
        for (const option of options) {
            votes[option] = 0;
        }

        const currentTime = await this.get('currentTime');
        const poll = {
            poll_id: pollId,
            question,
            options,
            votes,
            created_by: this.address,
            created_at: currentTime ?? null
        };

        const index = await this.get('poll/index');
        const nextIndex = Array.isArray(index) ? index.slice() : [];
        nextIndex.push(pollId);

        await this.put(pollKey, poll);
        await this.put('poll/index', nextIndex);
        await this.put('poll/latest', pollId);

        console.log('poll created', { poll_id: pollId, options: options.length, created_by: this.address });
    }

    async castVote(){
        this.assert(this.value?.op === 'cast_vote', new Error('invalid op for castVote'));

        const pollId = String(this.value.poll_id || '').trim();
        const nextOption = String(this.value.option || '').trim();
        this.assert(pollId !== '', new Error('poll_id is required'));
        this.assert(nextOption !== '', new Error('option is required'));

        const pollKey = `poll/${pollId}`;
        const poll = await this.get(pollKey);
        this.assert(poll !== null, new Error('poll not found'));

        const options = Array.isArray(poll.options) ? poll.options : [];
        this.assert(options.includes(nextOption), new Error('option is not available in this poll'));

        const votes = this.protocol.safeClone(poll.votes) || {};
        for (const option of options) {
            if (typeof votes[option] !== 'number') votes[option] = 0;
        }

        const voteKey = `poll/${pollId}/vote/${this.address}`;
        const previousVote = await this.get(voteKey);
        if (previousVote && typeof previousVote.option === 'string' && typeof votes[previousVote.option] === 'number') {
            votes[previousVote.option] = Math.max(0, votes[previousVote.option] - 1);
        }
        votes[nextOption] = (votes[nextOption] || 0) + 1;

        const currentTime = await this.get('currentTime');
        const updatedPoll = this.protocol.safeClone(poll) || {};
        updatedPoll.votes = votes;
        updatedPoll.updated_at = currentTime ?? null;

        await this.put(pollKey, updatedPoll);
        await this.put(voteKey, {
            voter: this.address,
            option: nextOption,
            updated_at: currentTime ?? null
        });

        console.log('vote updated', { poll_id: pollId, voter: this.address, option: nextOption });
    }

    async pollResults(){
        const requestedPollId = this.value?.poll_id ? String(this.value.poll_id).trim() : '';
        const latestPoll = await this.get('poll/latest');
        const pollId = requestedPollId || (latestPoll ? String(latestPoll) : '');
        if (pollId === '') {
            console.log('poll_results', { poll_id: null, message: 'no poll available yet' });
            return;
        }

        const poll = await this.get(`poll/${pollId}`);
        if (poll === null) {
            console.log('poll_results', { poll_id: pollId, message: 'poll not found' });
            return;
        }

        const votes = poll?.votes && typeof poll.votes === 'object' ? poll.votes : {};
        const standings = Object.entries(votes)
            .map(([option, count]) => [option, Number(count) || 0])
            .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
        let totalVotes = 0;
        for (const [, count] of standings) {
            totalVotes += count;
        }

        console.log('poll_results', {
            poll_id: poll.poll_id || pollId,
            question: poll.question || null,
            total_votes: totalVotes,
            standings
        });
    }

    async readSnapshot(){
        const something = await this.get('something');
        const currentTime = await this.get('currentTime');
        const msgl = await this.get('msgl');
        const msg0 = await this.get('msg/0');
        const msg1 = await this.get('msg/1');
        const latestPoll = await this.get('poll/latest');
        console.log('snapshot', {
            something,
            currentTime,
            msgl: msgl ?? 0,
            msg0,
            msg1,
            latestPoll
        });
    }

    async readKey(){
        const key = this.value?.key;
        const value = key ? await this.get(key) : null;
        console.log(`readKey ${key}:`, value);
    }

    async readChatLast(){
        const last = await this.get('chat_last');
        console.log('chat_last:', last);
    }

    async readTimer(){
        const currentTime = await this.get('currentTime');
        console.log('currentTime:', currentTime);
    }
}

export default SampleContract;
