
Tinytest.add("AddFieldsView", (test) => {
	let collection = new LocalCollection();
	let view = CV(collection).addFields({
		xSquared: o => o.x*o.x
	});
	test.instanceOf(view, CV.AddFieldsView, "CV(collection).addFields(object) should be an AddFieldsView");

	let _id1 = collection.insert({x: 2});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	obsLog.expect([{added: {_id: _id1, x: 2, xSquared: 4}}], "observe should fire added callbacks for existing elements.");
	fetchLog.expect([[{_id: _id1, x: 2, xSquared: 4}]], "fetch should work.");

	let _id2 = collection.insert({x: 3});
	Tracker.flush();
	obsLog.expect([{added: {_id: _id2, x: 3, xSquared: 9}}], "observe should fire added callbacks for new elements.");
	fetchLog.expect([[{_id: _id1, x: 2, xSquared: 4}, {_id: _id2, x: 3, xSquared: 9}]], "fetch should work reactively when adding elements.");

	collection.update(_id1, {$set: {x: 1}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: _id1, x: 1, xSquared: 1}, was: {_id: _id1, x: 2, xSquared: 4}}], "observe should fire changed callbacks for changed elements.");
	fetchLog.expect([[{_id: _id1, x: 1, xSquared: 1}, {_id: _id2, x: 3, xSquared: 9}]], "fetch should work reactively when changing elements.");

	collection.remove(_id2);
	Tracker.flush();
	obsLog.expect([{removed: {_id: _id2, x: 3, xSquared: 9}}], "observe should fire removed callbacks when removing elements.");
	fetchLog.expect([[{_id: _id1, x: 1, xSquared: 1}]], "fetch should work reactively when removing elements.");

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
