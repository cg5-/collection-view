
Tinytest.add("MapView", (test) => {
	let collection = new LocalCollection();
	let view = CV(collection).fmap(o => ({x: o.x*o.x}));
	test.instanceOf(view, CV.MapView, "CV(collection).fmap(function) should be a MapView");

	let _id1 = collection.insert({x: 2});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	obsLog.expect([{added: {_id: _id1, x: 4}}], "observe should fire added callbacks for existing elements.");
	fetchLog.expect([[{_id: _id1, x: 4}]], "fetch should work.");

	let _id2 = collection.insert({x: 3});
	Tracker.flush();
	obsLog.expect([{added: {_id: _id2, x: 9}}], "observe should fire added callbacks for new elements.");
	fetchLog.expect([[{_id: _id1, x: 4}, {_id: _id2, x: 9}]], "fetch should work reactively when adding elements.");

	collection.update(_id1, {$set: {x: 1}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: _id1, x: 1}, was: {_id: _id1, x: 4}}], "observe should fire changed callbacks for changed elements.");
	fetchLog.expect([[{_id: _id1, x: 1}, {_id: _id2, x: 9}]], "fetch should work reactively when changing elements.");

	collection.update(_id1, {$set: {x: -1}});
	Tracker.flush();
	obsLog.expect([], "observe should not fire changed callbacks when changing x1 -> x2 where f(x1) = f(x2).");
	fetchLog.expect([], "fetch should not re-run when changing x1 -> x2 where f(x1) = f(x2).");

	collection.remove(_id2);
	Tracker.flush();
	obsLog.expect([{removed: {_id: _id2, x: 9}}], "observe should fire removed callbacks when removing elements.");
	fetchLog.expect([[{_id: _id1, x: 1}]], "fetch should work reactively when removing elements.");

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
