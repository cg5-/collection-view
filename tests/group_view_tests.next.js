
Tinytest.add("GroupView", (test) => {
	let collection = new LocalCollection();
	let view = CV(collection).group({
		groupBy: ["g"],
		aggregate: {
			x: CV.sum("x")
		}
	});
	test.instanceOf(view, CV.GroupView, "CV(collection).group(function) should be a GroupView");

	let _id1 = collection.insert({g: "first", x: 1});
	let _id2 = collection.insert({g: "first", x: 1});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	let firstId = view.filter({g: "first"}).fetch()[0]._id

	obsLog.expect([{added: {_id: firstId, g: "first", x: 2}}], "observe should fire added callbacks for existing groups.");
	fetchLog.expect([[{_id: firstId, g: "first", x: 2}]], "fetch should work.");

	collection.update(_id2, {$set: {x: 2}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: firstId, g: "first", x: 3}, was: {_id: firstId, g: "first", x: 2}}], "observe should fire changed callbacks when updating element (preserving group).");
	fetchLog.expect([[{_id: firstId, g: "first", x: 3}]], "fetch should re-run when updating element (preserving group).");

	let _id3 = collection.insert({g: "first", x: 5});
	Tracker.flush();
	obsLog.expect([{changed: {_id: firstId, g: "first", x: 8}, was: {_id: firstId, g: "first", x: 3}}], "observe should fire changed callbacks when adding to existing group.");
	fetchLog.expect([[{_id: firstId, g: "first", x: 8}]], "fetch should re-run when adding elements to existing group.");

	collection.remove(_id3);
	Tracker.flush();
	obsLog.expect([{changed: {_id: firstId, g: "first", x: 3}, was: {_id: firstId, g: "first", x: 8}}],
	              "observe should fire removed callbacks when removing from existing group (not last element in the group).");
	fetchLog.expect([[{_id: firstId, g: "first", x: 3}]], "fetch should re-run when removing elements from existing group (not last element in the group).");

	let _id4 = collection.insert({g: "second", x: -2});
	Tracker.flush();
	let secondId = view.filter({g: "second"}).fetch()[0]._id;
	obsLog.expect([{added: {_id: secondId, g: "second", x: -2}}], "observe should fire added callbacks when creating new group");
	fetchLog.expect([[{_id: firstId, g: "first", x: 3}, {_id: secondId, g: "second", x: -2}]], "fetch should re-run when creating new group.");

	collection.update(_id2, {$set: {g: "second"}});
	Tracker.flush();
	obsLog.expect([{changed: {_id: firstId, g: "first", x: 1}, was: {_id: firstId, g: "first", x: 3}},
	               {changed: {_id: secondId, g: "second", x: 0}, was: {_id: secondId, g: "second", x: -2}}],
	               "observe should fire two changed when moving element between existing groups (old group survives)");
	fetchLog.expect([[{_id: firstId, g: "first", x: 1}, {_id: secondId, g: "second", x: 0}]],
	                "fetch should re-run when moving element between existing groups (old group survives).");

	collection.update(_id2, {$set: {g: "third"}});
	Tracker.flush();
	let thirdId = view.filter({g: "third"}).fetch()[0]._id;
	obsLog.expect([{changed: {_id: secondId, g: "second", x: -2}, was: {_id: secondId, g: "second", x: 0}},
	               {added: {_id: thirdId, g: "third", x: 2}}],
	               "observe should fire changed+added when moving element from old group to new group (old group survives)");
	fetchLog.expect([[{_id: firstId, g: "first", x: 1}, {_id: secondId, g: "second", x: -2}, {_id: thirdId, g: "third", x: 2}]],
	                "fetch should re-run when moving element from old group to new group (old group survives).");

	collection.update(_id2, {$set: {g: "fourth"}});
	Tracker.flush();
	let fourthId = view.filter({g: "fourth"}).fetch()[0]._id;
	obsLog.expect([{removed: {_id: thirdId, g: "third", x: 2}},
	               {added: {_id: fourthId, g: "fourth", x: 2}}],
	               "observe should fire removed+added when moving last element from old group to new group (old group dies)");
	fetchLog.expect([[{_id: firstId, g: "first", x: 1}, {_id: secondId, g: "second", x: -2}, {_id: fourthId, g: "fourth", x: 2}]],
	                "fetch should re-run when moving last element from old group to new group (old group dies).");

	collection.update(_id2, {$set: {g: "first"}});
	Tracker.flush();
	obsLog.expect([{removed: {_id: fourthId, g: "fourth", x: 2}},
	               {changed: {_id: firstId, g: "first", x: 3}, was: {_id: firstId, g: "first", x: 1}}],
	               "observe should fire removed+changed when moving last element from old group to existing group (old group dies)");
	fetchLog.expect([[{_id: firstId, g: "first", x: 3}, {_id: secondId, g: "second", x: -2}]],
	                "fetch should re-run when moving last element from old group to existing group (old group dies).");

	collection.remove(_id4);
	Tracker.flush();
	obsLog.expect([{removed: {_id: secondId, g: "second", x: -2}}], "observe should fire removed when removing the last element from a group");
	fetchLog.expect([[{_id: firstId, g: "first", x: 3}]], "fetch should re-run when removing the last element from a group");

	let _id5 = collection.insert({g: "first", x: 0});
	Tracker.flush();
	obsLog.expect([], "observe should fire no callbacks when adding element to existing group without affecting aggregate");
	fetchLog.expect([], "fetch should not re-run when adding element to existing group without affecting aggregate");

	collection.update(_id5, {$set: {y: 7}});
	Tracker.flush();
	obsLog.expect([], "observe should fire no callbacks when updating element (preserving group) without affecting aggregate");
	fetchLog.expect([], "fetch should not re-run when updating element (preserving group) without affecting aggregate");

	collection.remove(_id5);
	Tracker.flush();
	obsLog.expect([], "observe should fire no callbacks when removing element (not last element in group) without affecting aggregate");
	fetchLog.expect([], "fetch should not re-run when removing element (not last element in group) without affecting aggregate");

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
