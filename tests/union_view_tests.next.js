
Tinytest.add("UnionView", (test) => {
	let collection1 = new LocalCollection();
	let collection2 = new LocalCollection();
	let view = CV.union(collection1, collection2)
	test.instanceOf(view, CV.UnionView, "CV.union(collection1, collection2) should be a UnionView.");

	let _id1 = collection1.insert({x: 1});
	let _id2 = collection2.insert({x: 2});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	let newId1 = view.filter({x: 1}).fetch()[0]._id;
	let newId2 = view.filter({x: 2}).fetch()[0]._id;

	obsLog.expect([{added: {_id: newId1, x: 1}}, {added: {_id: newId2, x: 2}}], "observe should fire added callbacks for existing elements.");
	fetchLog.expect([[{_id: newId1, x: 1}, {_id: newId2, x: 2}]], "fetch should work.");

	let _id3 = collection2.insert({x: 3});
	Tracker.flush();
	let newId3 = view.filter({x: 3}).fetch()[0]._id;
	obsLog.expect([{added: {_id: newId3, x: 3}}], "observe should fire added callbacks for new elements.");
	fetchLog.expect([[{_id: newId1, x: 1}, {_id: newId2, x: 2}, {_id: newId3, x: 3}]], "fetch should re-run when adding elements.");

	collection1.update(_id1, {$set: {x: -1}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: newId1, x: -1}, was: {_id: newId1, x: 1}}], "observe should fire changed callbacks for changed elements.");
	fetchLog.expect([[{_id: newId1, x: -1}, {_id: newId2, x: 2}, {_id: newId3, x: 3}]], "fetch should re-run when changing elements.");

	collection2.remove(_id2);
	Tracker.flush();
	obsLog.expect([{removed: {_id: newId2, x: 2}}], "observe should fire removed callbacks when removing elements.");
	fetchLog.expect([[{_id: newId1, x: -1}, {_id: newId3, x: 3}]], "fetch should re-run when removing elements.");

	let doubleId = new Mongo.ObjectID();
	collection1.insert({_id: doubleId, x: 10});
	collection2.insert({_id: doubleId, x: 20});
	Tracker.flush();
	let newDoubleId1 = view.filter({x: 10}).fetch()[0]._id;
	let newDoubleId2 = view.filter({x: 20}).fetch()[0]._id;
	if (EJSON.equals(newDoubleId1, newDoubleId2)) {
		test.fail("UnionView should disambiguate _id in cases where two input views have elements with the same _id");
	}

	if (CV._activeViews > 0) {
		observer.stop();
		Tracker.flush();
		if (CV._activeViews === 0) test.fail("View suspended too early");
		autorun.stop();
		Tracker.flush();
		if (CV._activeViews > 0) test.fail("View didn't suspend");
		CV._activeViews = 0;
	} else {
		observer.stop();
		autorun.stop();
	}
});
