
Tinytest.add("PickView", (test) => {
	let collection = new LocalCollection();
	let view = CV(collection.find()).pick("x");
	test.instanceOf(view, CV.PickView, "CV(cursor).pick() should be a PickView.");

	let _id1 = collection.insert({x: 1, y: 2});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	obsLog.expect([{added: {_id: _id1, x: 1}}], "observe should fire added callbacks for existing elements.");
	fetchLog.expect([[{_id: _id1, x: 1}]], "fetch should work.");

	let _id2 = collection.insert({x: 2, y: 3});
	Tracker.flush();
	obsLog.expect([{added: {_id: _id2, x: 2}}], "observe should fire added callbacks for new elements.");
	fetchLog.expect([[{_id: _id1, x: 1}, {_id: _id2, x: 2}]], "fetch should re-run when elements are added.");

	collection.update(_id1, {$set: {x: 3, y: 4}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: _id1, x: 3}, was: {_id: _id1, x: 1}}], "observe should fire changed callbacks for changed elements.");
	fetchLog.expect([[{_id: _id1, x: 3}, {_id: _id2, x: 2}]], "fetch should re-run when elements are changed.");

	collection.update(_id1, {$set: {y: -2}});
	Tracker.flush();
	obsLog.expect([], "observe should not fire any callbacks when changing only a field that wasn't whitelisted.");
	fetchLog.expect([], "fetch should not re-run when changing only a field that wasn't whitelisted.");

	collection.remove(_id2);
	Tracker.flush();
	obsLog.expect([{removed: {_id: _id2, x: 2}}], "observe should fire removed callbacks when elements are removed.");
	fetchLog.expect([[{_id: _id1, x: 3}]], "fetch should re-run when elements are removed.");

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

Tinytest.add("OmitView", (test) => {
	let collection = new LocalCollection();
	let view = CV(collection.find()).omit("y");
	test.instanceOf(view, CV.OmitView, "CV(cursor).omit() should be an OmitView.");

	let _id1 = collection.insert({x: 1, y: 2});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	obsLog.expect([{added: {_id: _id1, x: 1}}], "observe should fire added callbacks for existing elements.");
	fetchLog.expect([[{_id: _id1, x: 1}]], "fetch should work.");

	let _id2 = collection.insert({x: 2, y: 3});
	Tracker.flush();
	obsLog.expect([{added: {_id: _id2, x: 2}}], "observe should fire added callbacks for new elements.");
	fetchLog.expect([[{_id: _id1, x: 1}, {_id: _id2, x: 2}]], "fetch should re-run when elements are added.");

	collection.update(_id1, {$set: {x: 3, y: 4}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: _id1, x: 3}, was: {_id: _id1, x: 1}}], "observe should fire changed callbacks for changed elements.");
	fetchLog.expect([[{_id: _id1, x: 3}, {_id: _id2, x: 2}]], "fetch should re-run when elements are changed.");

	collection.update(_id1, {$set: {y: -2}});
	Tracker.flush();
	obsLog.expect([], "observe should not fire any callbacks when changing only a field that was blacklisted.");
	fetchLog.expect([], "fetch should not re-run when changing only a field that was blacklisted.");

	collection.remove(_id2);
	Tracker.flush();
	obsLog.expect([{removed: {_id: _id2, x: 2}}], "observe should fire removed callbacks when elements are removed.");
	fetchLog.expect([[{_id: _id1, x: 3}]], "fetch should re-run when elements are removed.");

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
