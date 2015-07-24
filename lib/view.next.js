
/* Convert a Mongo.Collection or LocalCollection instance, or object implementing
 * the Cursor interface (observe and (fetch or forEach)) into
 * a View. If the argument is already a view, does nothing. */
CV = function (x) {
	if (x instanceof CV.View) return x;
	if (((typeof Mongo !== "undefined") && x instanceof Mongo.Collection) || x instanceof LocalCollection) {
		return new CV.CollectionView(x);
	}
	if (x && _.isFunction(x.observe) && (_.isFunction(x.fetch) || _.isFunction(x.forEach))) {
		return new CV.CursorView(x);
	}
	throw new Error("CV called with unknown arg: " + x.constructor.name + " " + x.toString());
};

// used by tests
CV._activeViews = 0;

/* If true, automatically check that View subclasses implement enough methods, and
 * throw an exception on construction if not. If false, there is a risk of infinite
 * recursion. */
const ENSURE_MINIMAL_IMPLEMENTATIONS = true;

/* Abstract base class for views.
 * observe and observeAfter have default implementations in terms of each other;
 * subclasses must implement at least one of them.
 * Same goes for forEachNonreactive and forEach.
 * No other methods need to be overridden, but they can be overridden if
 * the subclass has a more efficient implementation.
 *
 * Direct CV.View subclasses generally do not have any explicit ordering, and
 * do not have to natively support the ordered observe callbacks (addedAt, changedAt etc.).
 * Instead, they should start any observe/observeAfter implementation with
 *     if (callbacks.addedAt || callbacks.changedAt || callbacks.removedAt || callbacks.movedTo)
 *         return this.order().observeAfter(callbacks) // (or .observe(callbacks) as appropriate)
 * If a view has an explicit order, it should rather extend OrderedView. */
CV.View = class View {

	constructor() {
		this._reifiedVersion = null;
		if (ENSURE_MINIMAL_IMPLEMENTATIONS) {
			let isValid = true;
			if (this.observeAfter === CV.View.prototype.observeAfter && this.observe === CV.View.prototype.observe) {
				isValid = false;
			}
			if (this.forEachNonreactive === CV.View.prototype.forEachNonreactive && this.forEach === CV.View.prototype.forEach) {
				isValid = false;
			}
			if (!isValid) {
				throw new Error(this.constructor.name + ": must implement at least (observe or observeAfter) and (forEach or forEachNonreactive)");
			}
		}
	}

	/* observeAfter(callbacks)
	 * callbacks can have three functions as properties:
	 *   added(document)
	 *   changed(document, oldDocument)
	 *   removed(document)
	 * Returns an object with a stop function that must be called to stop observing;
	 * if called inside a computation, it will automatically be stopped when the computation is invalidated.
	 * None of the callbacks are run inside a computation.
	 * Unlike Mongo.Cursor.observe and View.observe, only changes that happen after creation of the
	 * observe handle will trigger callbacks. */
	observeAfter(callbacks) {
		if (callbacks.addedAt || callbacks.changedAt || callbacks.removedAt || callbacks.movedTo)
			return this.order().observeAfter(callbacks);

		let firstRun = true;
		let observer = this.observe({
			added: callbacks.added ? (x) => {
				if (!firstRun) callbacks.added(x);
			} : void(0),
			changed: callbacks.changed,
			removed: callbacks.removed
		});
		firstRun = false;
		return observer;
	}

	/* observe(callbacks)
	 * callbacks can have three functions as properties:
	 *   added(document)
	 *   changed(document, oldDocument)
	 *   removed(document)
	 * Returns an object with a stop function that must be called to stop observing;
	 * if called inside a computation, it will automatically be stopped when the computation is invalidated.
	 * Like Mongo.Cursor.observe, the initial data set will be provided as synchronous added callbacks.
	 * None of the callbacks are run inside a computation. This is intentionally different from Mongo.Cursor.observe,
	 * which runs the initial "added" callbacks in a computation, but not any subsequent callbacks.
	 *
	 * */
	observe(callbacks) {
		if (callbacks.addedAt || callbacks.changedAt || callbacks.removedAt || callbacks.movedTo)
			return this.order().observe(callbacks);

		if (callbacks.added) {
			this.forEachNonreactive(callbacks.added);
		}
		return this.observeAfter(callbacks);
	}

	/* forEachNonreactive(callback)
	 * Call the callback once for each document in the current data set.
	 * Unlike Mongo.Cursor.forEach, only passes the actual document (not also an index and the view itself).
	 * Does not register a dependency on the current data set, even if called from inside a reactive computation,
	 * and the callbacks themselves are not run in a computation. */
	forEachNonreactive(callback) {
		if (Meteor.isServer || !Tracker.active) {
			this.forEach(callback);
		} else {
			Tracker.nonreactive(() => {
				this.forEach(callback);
			});
		}
	}

	/* fetch()
	 * Returns the current data set as an array.
	 * If called from a computation, registers a dependency on the current data set. */
	fetch() {
		if (this.forEach !== CV.View.prototype.forEach) {
			let result = [];
			this.forEach((x) => {
				result.push(x);
			});
			return result;
		} else {
			let result = [];
			this.forEachNonreactive((x) => {
				result.push(x);
			});
			if (!Meteor.isServer && Tracker.active) {
				let computation = Tracker.currentComputation;
				let invalidate = computation.invalidate.bind(computation);
				this.observeAfter({
					added: invalidate,
					changed: invalidate,
					removed: invalidate
				});
			}
			return result;
		}
	}

	/* forEach(callback)
	 * Call the callback once for each document in the data set.
	 * Unlike Mongo.Cursor.forEach, only passes the actual document (not also an index and the view itself).
	 * Registers a dependency on the current data set if called from inside a reactive computation.
	 * The callbacks are run inside the current computation, if there is one. */
	forEach(callback) {
		if (Meteor.isServer || !Tracker.active) {
			this.forEachNonreactive(callback);
		} else {
			let array = this.fetch();
			for (let doc of array) callback(doc);
		}
	}

	/* Some views have "auto-suspend" functionality, where they automatically
	 * suspend themselves when they aren't being used. This is largely transparent
	 * to users, but if you want more control, you can call keepAlive. This returns
	 * a "keep-alive handle" - an object with a "stop" method. Until "stop" is called,
	 * the view is guaranteed not to auto-suspend. This is sometimes useful, since
	 * "waking up" a view from a suspended state can be expensive.
	 * If you call keepAlive from a computation, the keep-alive handle will
	 * automatically stop itself when the computation is invalidated. */
	keepAlive() {
		return {stop: function() {}}
	}

	/* explain()
	 * Prints to the console an vaguely-useful explanation of how the view is computed. This could
	 * help you improve performance, but it probably won't. */
	explain() {
		console.log("<explain not implemented>");
	}

	isOrdered() {
		return false;
	}

	/* Create a copy of this view which is "reified" in a Minimongo collection. This should have no
	 * effect on functionality, but it might improve performance at the expense of memory usage. */
	reify() {
		this._reifiedVersion = this._reifiedVersion || new CV.ReifierView(new CV.SimpleReifier(this));
		return this._reifiedVersion;
	}

	order() {
		return this.reify();
	}

	/* Filter the view by a predicate, returning a new view. The predicate can be either
	 * a Mongo-style selector (see Meteor docs), or a function taking a document and returning
	 * true or false. If it is a function, the function MUST BE PURE (not depend on mutable
	 * state) - if it is not pure, all sorts of chaos might ensue. Mongo-style selectors
	 * are preferable, especially on the server, since in some cases they can use the indexes
	 * on the underlying collection (try calling "explain" to see). */
	filter(pred) {
		return new CV.FilterView(this, pred);
	}

	/* Transform a view by mapping a function over it, returning a new view. The function
	 * MUST BE PURE (not depend on mutable state) - if it isn't, all sorts of chaos might
	 * ensue. The function takes a document and should return a new EJSON-able document,
	 * although you don't have to put the _id in; it will do that for you. */
	fmap(func) {
		return new CV.MapView(this, func);
	}

	/* Add new fields to each document in the view, computed in terms of the other fields,
	 * returning a new view.
	 * Pass in an object where the keys are the names of the new fields, and the values are
	 * functions taking a document and returning the value of the new field.
	 * The functions MUST BE PURE, you know the drill. */
	addFields(fields) {
		if (_.isEmpty(fields)) return this;
		return new CV.AddFieldsView(this, fields);
	}

	/* Return a new view, excluding fields from each document which aren't in the whitelist.
	 * It's recommended to throw away fields you don't want as soon as possible to improve
	 * fine-grained reactivity. The _id field will always be there even if you
	 * don't explicitly pick it. */
	pick(...whitelist) {
		if (whitelist.length === 0 && _.isArray(whitelist[0])) whitelist = whitelist[0];
		return new CV.PickView(this, whitelist);
	}

	/* Return a new view, excluding fields from each document which are in the blacklist.
	 * It's recommended to throw away fields you don't want as soon as possible to improve
	 * fine-grained reactivity. */
	omit(...blacklist) {
		if (blacklist.length === 1 && _.isArray(blacklist[0])) blacklist = blacklist[0];
		if (blacklist.length === 0) return this;
		if (_.contains(blacklist, "_id")) {
			throw new Error("Can't omit _id");
		}
		return new CV.OmitView(this, blacklist);
	}

	/* Create a new view by grouping the documents and aggregating the groups.
	 * Pass an object with up to two fields:
	 *   groupBy: array of fields to group by. If this is missing or [], the resulting
	              view will have at most one document, summarising the entire input view.
	     aggregate: object containing aggregated fields to compute. The keys of this object
	                are the names of the aggregated fields and the values describe what
	                to aggregate. Right now the values can be CV.sum("fieldName") or CV.count,
	                or you could write a custom aggregator by implementing a simple interface which
	                I won't describe here. If this is missing or {}, don't aggregate anything,
	                in effect creating a SELECT DISTINCT. */
	group(obj) {
		return new CV.GroupView(this, obj);
	}

	/* Sort the view according to a Mongo.Collection-style sort specifier (see Meteor docs),
	 * returning a new view. Not guaranteed to be stable. Most transformation functions will
	 * destroy the order of the view, so it's recommended to call this as the last step
	 * in the chain. */
	sort(sortSpecifier) {
		return this.order().sort(sortSpecifier);
	}
}

/* Return the disjoint union of multiple views. That is, the resulting view will contain
 * all the documents from each input view, and if a document is in two of the input views, it will
 * appear twice in the result. */
CV.union = function (...views) {
	if (views.length === 1 && _.isArray(views[0])) views = views[0];
	if (views.length === 0) return CV.emptySet;
	if (views.length === 1) return views[0];
	return new CV.UnionView(...views);
}

CV.emptySet = Object.create(CV.View.prototype);
function noop() {}
function returnThis() { return this; }
CV.emptySet.observeAfter = CV.emptySet.forEachNonreactive = CV.emptySet.forEach = noop;
CV.emptySet.explain = () => { console.log("empty set"); };
CV.emptySet.fmap = CV.emptySet.pick = CV.emptySet.omit = CV.emptySet.filter = CV.emptySet.select = CV.emptySet.reify = CV.emptySet.order = CV.emptySet.sort = returnThis;
