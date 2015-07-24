
Tinytest.add("Premier League", (test) => {
	let MatchResults = new Mongo.Collection(null);
	// Match results chosen at random. I don't actually know soccer.
	MatchResults.insert({home: "Manchester United", away: "Chelsea", homeGoals: 3, awayGoals: 2});
	MatchResults.insert({home: "Arsenal", away: "Chelsea", homeGoals: 0, awayGoals: 3});

	let homeMatches = CV(MatchResults).fmap(o => ({
		team: o.home,
		wins: o.homeGoals > o.awayGoals ? 1 : 0,
		losses: o.homeGoals < o.awayGoals ? 1 : 0,
		draws: o.homeGoals === o.awayGoals ? 1 : 0,
		goalDifference: o.homeGoals - o.awayGoals
	}));

	let awayMatches = CV(MatchResults).fmap(o => ({
		team: o.away,
		wins: o.awayGoals > o.homeGoals ? 1 : 0,
		losses: o.awayGoals < o.homeGoals ? 1 : 0,
		draws: o.awayGoals === o.homeGoals ? 1 : 0,
		goalDifference: o.awayGoals - o.homeGoals
	}));

	let view = CV.union(homeMatches, awayMatches).group({
		groupBy: ["team"],
		aggregate: {
			played: CV.count,
			wins: CV.sum("wins"),
			losses: CV.sum("losses"),
			draws: CV.sum("draws"),
			goalDifference: CV.sum("goalDifference"),
		}
	}).addFields({
		points: o => 3*o.wins + o.draws // I think?
	}).sort({points: -1, goalDifference: -1});

	let obsLog = new testHelpers.LogList(test);
	let observer = testHelpers.testObserve(view, obsLog);

	let fetchLog = new testHelpers.LogList(test);
	let autorun = testHelpers.testFetch(view, fetchLog);

	let muId = view.filter({team: "Manchester United"}).fetch()[0]._id;
	let chelId = view.filter({team: "Chelsea"}).fetch()[0]._id;
	let arsId = view.filter({team: "Arsenal"}).fetch()[0]._id;

	// Warning: It doesn't matter what order these added callbacks happen in. The test should
	// really ignore them. If you get a fail, but it's just the order which is wrong, then
	// it's not really a fail.
	obsLog.expect([
		{added: {"_id": muId,   "team": "Manchester United", "played": 1, "wins": 1, "losses": 0, "draws": 0, "goalDifference":  1, "points": 3}},
		{added: {"_id": arsId,  "team": "Arsenal",           "played": 1, "wins": 0, "losses": 1, "draws": 0, "goalDifference": -3, "points": 0}},
		{added: {"_id": chelId, "team": "Chelsea",           "played": 2, "wins": 1, "losses": 1, "draws": 0, "goalDifference":  2, "points": 3}}
	]);
	fetchLog.expect([[
		{"_id": chelId, "team": "Chelsea",           "played": 2, "wins": 1, "losses": 1, "draws": 0, "goalDifference":  2, "points": 3},
		{"_id": muId,   "team": "Manchester United", "played": 1, "wins": 1, "losses": 0, "draws": 0, "goalDifference":  1, "points": 3},
		{"_id": arsId,  "team": "Arsenal",           "played": 1, "wins": 0, "losses": 1, "draws": 0, "goalDifference": -3, "points": 0}
	]]);

	MatchResults.insert({home: "Cambridge United", away: "Manchester United", homeGoals: 2, awayGoals: 1}); // I wish
	Tracker.flush();
	let cuId = view.filter({team: "Cambridge United"}).fetch()[0]._id;
	obsLog.expect([
		{added: {"_id": cuId, "team": "Cambridge United", "played": 1, "wins": 1, "losses": 0, "draws": 0, "goalDifference": 1, "points": 3}},
		{
			changed: {"_id": muId, "team": "Manchester United", "played": 2, "wins": 1, "losses": 1, "draws": 0, "goalDifference": 0, "points": 3},
			was:     {"_id": muId, "team": "Manchester United", "played": 1, "wins": 1, "losses": 0, "draws": 0, "goalDifference": 1, "points": 3},
		}
	]);
	fetchLog.expect([[
		{"_id": chelId, "team": "Chelsea",           "played": 2, "wins": 1, "losses": 1, "draws": 0, "goalDifference":  2, "points": 3},
		{"_id": cuId,   "team": "Cambridge United",  "played": 1, "wins": 1, "losses": 0, "draws": 0, "goalDifference":  1, "points": 3},
		{"_id": muId,   "team": "Manchester United", "played": 2, "wins": 1, "losses": 1, "draws": 0, "goalDifference":  0, "points": 3},
		{"_id": arsId,  "team": "Arsenal",           "played": 1, "wins": 0, "losses": 1, "draws": 0, "goalDifference": -3, "points": 0}
	]]);

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
