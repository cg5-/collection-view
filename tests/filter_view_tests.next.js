
Tinytest.add("FilterView", (test) => {
	let collection = new LocalCollection();
	let view = CV(collection).filter((o) => {
		let result = (o.x % 2) === 1;
		o.x = "needs more EJSON.clone"; // should not appear in any callbacks or fetches
		return result;
	});
	test.instanceOf(view, CV.FilterView, "CV(collection).filter(function) should be a FilterView.");

	let _id1 = collection.insert({x: 1});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	obsLog.expect([{added: {_id: _id1, x: 1}}], "observe should fire added callbacks for existing elements.");
	fetchLog.expect([[{_id: _id1, x: 1}]], "fetch should work.");

	let _id2 = collection.insert({x: 3});
	Tracker.flush();
	obsLog.expect([{added: {_id: _id2, x: 3}}], "observe should fire added callbacks for new elements matching the predicate.");
	fetchLog.expect([[{_id: _id1, x: 1}, {_id: _id2, x: 3}]], "fetch should re-run when adding elements matching the predicate.");

	let _id3 = collection.insert({x: 4});
	Tracker.flush();
	obsLog.expect([], "observe should not fire added callbacks for new elements not matching the predicate.");
	fetchLog.expect([], "fetch should not re-run when adding elements not matching the predicate.");

	collection.update(_id1, {$set: {x: 5}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: _id1, x: 5}, was: {_id: _id1, x: 1}}], "observe should fire changed callbacks when changing matching elements (still matching).");
	fetchLog.expect([[{_id: _id1, x: 5}, {_id: _id2, x: 3}]], "fetch should re-run when changing matching elements (still matching).");

	collection.update(_id1, {$set: {x: 6}});
	Tracker.flush();
	obsLog.expect([{removed: {_id: _id1, x: 5}}], "observe should fire removed callbacks when changing matching elements (no longer matching).");
	fetchLog.expect([[{_id: _id2, x: 3}]], "fetch should re-run when changing matching elements (no longer matching).");

	collection.update(_id1, {$set: {x: 5}});
	Tracker.flush();
	obsLog.expect([{added: {_id: _id1, x: 5}}], "observe should fire added callbacks when changing non-matching elements (now matching).");
	fetchLog.expect([[{_id: _id1, x: 5}, {_id: _id2, x: 3}]], "fetch should re-run when changing non-matching elements (now matching).");

	collection.update(_id3, {$set: {x: 8}});
	Tracker.flush();
	obsLog.expect([], "observe should fire no callbacks when changing non-matching elements (still not matching).");
	fetchLog.expect([], "fetch should not re-run when changing non-matching elements (still not matching).");

	collection.remove(_id2);
	Tracker.flush();
	obsLog.expect([{removed: {_id: _id2, x: 3}}], "observe should fire removed callbacks when matching elements are removed.");
	fetchLog.expect([[{_id: _id1, x: 5}]], "fetch should re-run when matching elements are removed.");

	collection.remove(_id3);
	Tracker.flush();
	obsLog.expect([], "observe should not fire removed callbacks when non-matching elements are removed.");
	fetchLog.expect([], "fetch should not re-run when non-matching elements are removed.");

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
