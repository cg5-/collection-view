
# CollectionView

Minimongo allows you to do some transformations to your data before rendering it, but this functionality can
be limiting at times. If you need more advanced transformations, it is tempting to `fetch` the cursor and do the
transformations manually, but this ruins fine-grained reactivity. CollectionView aims to allow more advanced
transformations without sacrificing fine-grained reactivity.

Note: CollectionView is not currently production-ready and before version 1.0.0 there may be breaking changes
(although I will try to avoid these).

# Examples

## Sort by a computed field

```js
var sortedPosts = CV(Posts).addFields({
	score: function (post) {
		return post.upvotes - post.downvotes;
	}
}).sort({score: -1});
```

## Compute a league table from a collection of match results

Given a collection `MatchResults` with fields

    {home: string, homeGoals: integer, away: string, awayGoals: integer}

```js
var homeMatches = CV(MatchResults).fmap(function (o) {
	return {
		team: o.home,
		wins: o.homeGoals > o.awayGoals ? 1 : 0,
		losses: o.homeGoals < o.awayGoals ? 1 : 0,
		draws: o.homeGoals === o.awayGoals ? 1 : 0,
		goalDifference: o.homeGoals - o.awayGoals
	}
});

var awayMatches = CV(MatchResults).fmap(function (o)  {
	return {
		team: o.away,
		wins: o.awayGoals > o.homeGoals ? 1 : 0,
		losses: o.awayGoals < o.homeGoals ? 1 : 0,
		draws: o.awayGoals === o.homeGoals ? 1 : 0,
		goalDifference: o.awayGoals - o.homeGoals
	}
});

var table = CV.union(homeMatches, awayMatches).group({
	groupBy: ["team"],
	aggregate: {
		played: CV.count,
		wins: CV.sum("wins"),
		losses: CV.sum("losses"),
		draws: CV.sum("draws"),
		goalDifference: CV.sum("goalDifference"),
	}
}).addFields({
	points: function (o) {
		return 3*o.wins + o.draws
	}
}).sort({points: -1, goalDifference: -1});
```

This gives us a table with fields

    {team: String, played: integer, wins: integer, losses: integer, draws: integer, goalDifference: integer, points: integer}

sorted by points and then goal difference.
When another match is added, only the two teams involved in the match are rerendered.

## API

Views are like cursors and support many of the same methods.
You can iterate over them in templates using `{{#each}}`, just like a cursor.
They also have some additional methods that transform them into new views.

The elements in a view must be EJSONable values, and always contain an
`_id` field which is unique within the view.

### CV(View | Collection | Cursor) -> View

Create a View out of a collection or cursor.

### view.filter(<mongo selector> | Object -> Object) -> View

Filter the view by a predicate, returning a new view. The predicate can be either
a Mongo-style selector (see Meteor docs), or a function taking a document and returning
true or false. If it is a function, the function MUST BE PURE (not depend on mutable
state) - if it is not pure, all sorts of chaos might ensue. Mongo-style selectors
are preferable, especially on the server, since in some cases they can use the indexes
on the underlying collection (try calling "explain" to see).

### view.fmap(Object -> Object) -> View

Transform a view by mapping a function over it, returning a new view. The function
MUST BE PURE (not depend on mutable state) - if it isn't, all sorts of chaos might
ensue. The function takes a document and should return a new EJSON-able document,
although you don't have to put the _id in; it will do that for you.

### view.addFields({field1: Object -> value, field2: Object -> value, ...}) -> View

Add new fields to each document in the view, computed in terms of the other fields,
returning a new view.
Pass in an object where the keys are the names of the new fields, and the values are
functions taking a document and returning the value of the new field.
The functions MUST BE PURE, you know the drill.

### view.pick(...string) -> View

Return a new view, excluding fields from each document which aren't in the whitelist.
Takes either multiple strings as variadic arguments, or an array of strings.
It's recommended to throw away fields you don't want as soon as possible to improve
fine-grained reactivity. The _id field will always be there even if you
don't explicitly pick it.

### view.omit(...string) -> View

Return a new view, excluding fields from each document which are in the blacklist.
Takes either multiple strings as variadic arguments, or an array of strings.
It's recommended to throw away fields you don't want as soon as possible to improve
fine-grained reactivity.

### view.group({groupBy: [strings], aggregate: {field1: aggregator, field2: aggregator, ...}}) -> View

Create a new view by grouping the documents and aggregating the groups.
Pass an object with up to two fields:

groupBy: array of fields to group by. If this is missing or [], the resulting
view will have at most one document, summarising the entire input view.

aggregate: object containing aggregated fields to compute. The keys of this object
are the names of the aggregated fields and the values describe what
to aggregate. Right now the values can be CV.sum("fieldName") or CV.count,
or you could write a custom aggregator by implementing a simple interface.
If this is missing or {}, don't aggregate anything, in effect creating a SELECT DISTINCT.

#### Aggregator interface

An aggregator is an object with fields `initial: Object -> value`,
`add: (value, Object) -> value` and `subtract: (value, Object) -> value`.
For example, `CV.sum` is implemented as:

	CV.sum = function (fieldName) {
		return {
			initial: function (doc) { return doc[fieldName]; },
			add: function (total, doc) { return total + doc[fieldName]; },
			subtract: function (total, doc) { total - doc[fieldName]; }
		};
	};

### CV.union(...View) -> View

Return the disjoint union of multiple views. That is, the resulting view will contain
all the documents from each input view, and if a document is in two of the input views, it will
appear twice in the result. Takes either multiple views as variadic arguments, or an array of views.

### view.sort(sortSpecifier) -> View

Sort the view according to a Mongo.Collection-style sort specifier (see Meteor docs),
returning a new view. Not guaranteed to be stable. Most transformation functions will
destroy the order of the view, so it's recommended to call this as the last step
in the chain.

### view.observe(observeCallbacks) -> void

Much like `observe` in the standard Meteor Cursor.
Returns an object with a `stop` function that must be called to stop observing;
if called inside a computation, it will automatically be stopped when the computation is invalidated.
Like `Mongo.Cursor.observe`, the initial data set will be provided as synchronous added callbacks.
None of the callbacks are run inside a computation. This is intentionally different from Mongo.Cursor.observe,
which runs the initial "added" callbacks in a computation, but not any subsequent callbacks.

### view.forEach(Object -> void) -> void

Call the callback once for each document in the data set.
Unlike `Mongo.Cursor.forEach`, only passes the actual document (not also an index and the view itself).
Registers a dependency on the current data set if called from inside a reactive computation.
The callbacks are run inside the current computation, if there is one.

### view.fetch() -> [Object]

Returns the current data set as an array.
If called from a computation, registers a dependency on the current data set.

### view.forEachNonreactive(Object -> void) -> void

forEachNonreactive(callback)
Call the callback once for each document in the current data set.
Unlike `Mongo.Cursor.forEach`, only passes the actual document (not also an index and the view itself).
Does not register a dependency on the current data set, even if called from inside a reactive computation,
and the callbacks themselves are not run in a computation.

### view.observeAfter(observeCallbacks) -> void

Much like `observe` in the standard Meteor Cursor, except you don't receive
the initial data set as `added` callbacks. That is, only changes to the data set which occur
after this method is called will trigger callbacks.
Returns an object with a `stop` function that must be called to stop observing;
if called inside a computation, it will automatically be stopped when the computation is invalidated.
None of the callbacks are run inside a computation.

# Future considerations

* Versions of `fmap`/`addFields`/`filter` where the mapper/predicate function can access arbitrary reactive
  state. An autorun would have to be created for each element.
* Some kind of join?
* Limit/offset
* A transformer that adds each element's index to the element. Potentially slow, as if an element is removed
  somewhere in the middle, then all subsequent elements have to trigger a change. And MDG plans to add
  something similar to core anyway.
* ...