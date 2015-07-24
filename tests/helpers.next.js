
testHelpers = {}

testHelpers.LogList = class LogList {
	constructor(test) {
		this.test = test;
		this.list = [];
	}

	log(object) {
		this.list.push(object);
	}

	expect(expected, message) {
		let list = this.list;
		this.list = [];
		if (!EJSON.equals(list, expected)) {
			this.test.fail((message || "") + ` Expected ${EJSON.stringify(expected)}, got ${EJSON.stringify(list)}`);
		}
	}
}

testHelpers.testObserve = function (view, logList) {
	return Tracker.autorun(() => view.observe({
		added(doc) {
			if (Tracker.active) logList.log("Added called inside reactive computation!");
			logList.log({added: EJSON.clone(doc)});
			doc.x = "need more EJSON.clone";
		},
		changed(doc, oldDoc) {
			if (Tracker.active) logList.log("Changed called inside reactive computation!");
			logList.log({changed: EJSON.clone(doc), was: oldDoc});
			doc.x = "need more EJSON.clone";
		},
		removed(doc) {
			if (Tracker.active) logList.log("Removed called inside reactive computation!");
			logList.log({removed: EJSON.clone(doc)});
			doc.x = "need more EJSON.clone";
		}
	}));
};

testHelpers.testFetch = function (view, logList) {
	return Tracker.autorun(() => {
		logList.log(view.fetch());
	});
}
