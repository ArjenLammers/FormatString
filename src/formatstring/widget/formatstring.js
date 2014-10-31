dojo.provide("formatstring.widget.formatstring");

mxui.widget.declare('formatstring.widget.formatstring', {
	addons : [dijit._Templated],
	inputargs: {
		
		attrs : '',
		onclickmf : '',
		displaystr : '',
		emptystr : '',
		datetimeago : '',
		dateformat : '',
		timeformat : '',
		decimalPrecision: 2,
		UseCommaDecimal: '',
		renderHTML : ''
		
	},
	
	templateString : "<div><div dojoAttachPoint='divNode'></div></div>",
	
	list : null,
	formats : null,
	_hasStarted : false,
	evtHandler  : null,
	
	startup : function() {
		if (this._hasStarted)
			return;

		this._hasStarted = true;
		this.domNode.tabIndex = '-1';
		
		this.list = this.attrs.split(';');
		var timeagoformats = this.datetimeago.split(';');
		var dateformats = this.dateformat.split(';');
		var timeformats = this.timeformat.split(';');
		var renderHTML = this.renderHTML.split(';')
		var renderUseCommaDecimal = this.UseCommaDecimal.split(';')

		var i = -1, attrib;
		this.formats = [];
		while (attrib = this.list[++i]) {
			var formatMap = {
				timeago    : timeagoformats[i] === 'true',
				dateformat : dateformats[i],
				timeformat : timeformats[i],
				renderHTML : renderHTML[i] === 'true',
				CommaDecimal : renderUseCommaDecimal[i] === 'true',
				attr : attrib,
				idx : i
			};
			this.formats[i] = formatMap;
		}


		this.actLoaded();
	},
	
	update : function(obj, callback) {
		if (!obj) {
			this.divNode.innerHTML  = this.emptystr? this.emptystr: '';	
			typeof(callback) == "function" && callback();
			return;
		}
		this.guid = obj.getGUID();
		this.subscribe({
			guid : obj.getGUID(),
			callback : this.objChanged
		});

		this.getEverything(obj, this.list, dojo.hitch(this, function (datamap) {
			var attrvalues = [];
			for (var i = 0; i < this.formats.length; i++) 
				this.processValue(obj, this.formats[i], datamap, attrvalues);

			this.buildString(attrvalues);
		}));

		typeof(callback) == "function" && callback();
	},

	processValue : function (obj, format, data, attrvalues) {

		var meta = null;
		var value = data[format.attr];

		var getEnumVal = function (attr, value) {
			var val = '';
			var enummap = meta.getEnumMap(attr);
			for (var i = 0; enummap.length > i; i++) {
				if (enummap[i].key == value) {
					val = enummap[i].caption;
					break;
				}
			}
			return val;
		};

		var attrsplit = format.attr.split("/");
		if (attrsplit.length > 1) {
			meta = mx.metadata.getMetaEntity({ className: attrsplit[1] });
			if(meta && meta.getAttributeType(attrsplit[2]) == 'Enum') {
				value = getEnumVal(attrsplit[2], value);
			}
		} else {
			meta = mx.metadata.getMetaEntity({ className: obj.getClass() });
			if(meta && meta.getAttributeType(format.attr) == 'Enum') {
				value = getEnumVal(format.attr, value);
			}
		}

		if (format.timeago === true && value != "") {
			value = this.parseTimeAgo(value);
		} else if ((format.dateformat != '' || format.timeformat != '') && value != '') {
			var selector = 'date';
			if (format.dateformat != '' && format.timeformat != '')
				selector = 'datetime';
			else if (format.timeformat != '')
				selector = 'time';
			
			value = dojo.date.locale.format(new Date(value), {
				selector : selector,
				datePattern : format.dateformat,
				timePattern : format.timeformat
			});
		}

		var attrType = obj.metaData.getAttributeType(format.attr);
		if ( value != '') {
			if((attrType == 'Float' || attrType == 'Currency') && value != '') {
				value = this.decimalCheck(obj.get(format.attr));
			}	
			if ( value !='') {
			   if (format.CommaDecimal === true ) {
				value = value.replace(".", ",");
			   }
			} 
			if (value == '' && this.emptystr != '<>') {
				value = this.emptystr;
			}
		}

		if (!format.renderHTML)
			value = mxui.dom.escapeHTML(value); 
		
		attrvalues[format.idx] = value;
	},

	parseTimeAgo : function (value) {
		var date = new Date(value),
		now = new Date(),
		appendStr = (date > now)?'from now':'ago',
		diff = Math.abs(now.getTime() - date.getTime()),
		seconds = Math.floor(diff / 1000),
		minutes = Math.floor(seconds / 60),
		hours = Math.floor(minutes / 60),
		days = Math.floor(hours / 24),
		weeks = Math.floor(days / 7),
		months = Math.floor(days / 31),
		years = Math.floor(months / 12);
		
		function createTimeAgoString(nr, unitSingular, unitPlural) {
			return nr + " " + (nr === 1 ? unitSingular : unitPlural) + " "+appendStr;
		}
		
		if (seconds < 60) {
			return createTimeAgoString(seconds, "second", "seconds");
		} else if (minutes < 60) {
			return createTimeAgoString(minutes, "minute", "minutes");
		} else if (hours < 24) {
			return createTimeAgoString(hours, "hour", "hours");
		} else if (days < 7) {
			return createTimeAgoString(days, "day", "days");
		} else if (weeks < 5) {
			return createTimeAgoString(weeks, "week", "weeks");
		} else if (months < 12) {
			return createTimeAgoString(months, "month", "months");
		} else if (years < 10) {
			return createTimeAgoString(years, "year", "years");
		} else {
			return "a long time "+appendStr;
		}

	},
	
	buildString : function (attrvalues) {
		var msg = this.displaystr.replace(/\$\{(\d+)\}/gi, dojo.hitch(this, function(_, m2) {
			var value = attrvalues[(+m2)]; //str -> int
			if (!value && this.emptystr != '')
				return this.emptystr;
			else
				return value?value:'';
		}));
		
		this.divNode.innerHTML = msg;
		this.evtHandler && this.disconnect(this.evtHandler);
		this.evtHandler = this.connect(this.domNode, 'onclick', dojo.hitch(this, this.execmf));
	},
	
	objChanged : function (objId) {
		mx.processor.get({
			guid : objId,
			callback : this.update
		}, this);
	},
	
	execmf : function() {
		if (this.onclickmf != '') {
			var args = {
				actionname	: this.onclickmf,
				callback	: function() {
					// ok	
				},
				error		: function() {
					// error
				},
				applyto : 'selection',
				guids : [this.guid]
			};
			mx.xas.action(args);
		}
	},

	getEverything : function (obj, attrArr, callback) {
		var dataMap = {},
		missingAttrs = false,
		useRefs = false,
		schema = {
			attributes : [],
			references : {}
		};
		this.refs = {};

		var i = 0, attr;
		while (attr = attrArr[i++]) {
			var refcheck = attr.match("/");
			if (refcheck !== null && refcheck.length > 0) {
				var refattr = attr.split("/");
				var child;
				if (obj.hasAttribute(refattr[0]) && typeof(child = obj.get(refattr[0])) == "Object") {
					dataMap[attr] = child.get(refattr[2]);
				} else {
					if (!schema.references[refattr[0]])
						schema.references[refattr[0]] = { attributes : [refattr[2]] };
					else if (dojo.indexOf(schema.references[refattr[0]].attributes, refattr[2]) == -1)
						schema.references[refattr[0]].attributes.push(refattr[2]);
					
					if(!this.refs[refattr[0]])
						this.refs[refattr[0]] = [attr];
					else
						this.refs[refattr[0]].push(attr);
					
					useRefs = true;
				}
			} else if (!obj.hasAttribute(attr)) {
				schema.attributes.push(attr);
				missingAttrs = true;
			} else {
				dataMap[attr] = obj.get(attr);
			}
		}
		var getMissing = function (newObj, scope) {
			var k = -1, flatattr;
			while (flatattr = schema.attributes[++k]) {
				dataMap[flatattr] = newObj.get(flatattr);
			}
		};

		var getRefs = function (newObj, scope) {
			for (var ref in scope.refs) {
				var refattrs = scope.refs[ref];
				var child = newObj.getChild(ref);
				var j = -1, refattr;
				while (refattr = refattrs[++j]) {
					if (child.hasAttribute(refattr.split("/")[2]))
						dataMap[refattr] = child.get(refattr.split("/")[2]);
					else
						dataMap[refattr] = '';
				}
			}
		};

		if (useRefs) {
			mx.processor.get({
				xpath : '//'+obj.getClass()+'[id = "'+ obj.getGUID()+'"]',
				filter : schema,
				callback : dojo.hitch(this, function (newObjArr) {
					var newObj = newObjArr[0];
					getRefs(newObj, this);
					getMissing(newObj, this);
					callback(dataMap);
				})
			});
		} else if (missingAttrs) {
			mx.processor.get({
				guid : obj.getGUID(),
				filter : schema, // this. weggehaald!
				callback : dojo.hitch(this, function (newObj) {
					getMissing(newObj);
					callback(dataMap);
				})
			});
		} else {
			callback(dataMap);
		}
	},

	decimalCheck : function(value) {
		var roundedValue = value;
		var split = roundedValue.toString().split('.');
		//if not 0
		if (split[1] != undefined) {
			if(split[1].length > this.decimalPrecision) {
				for (i = (split[1].length) - 1; i >= this.decimalPrecision;i--) {
	   				//make a helper attribute for accuracy
	   				var roundAttr = '100';
	    			for (j = 1;j <= i; j++) {
	    				roundAttr = roundAttr + '0';
	    			}
	   				roundAttr = parseInt(roundAttr);
	    			var roundedValue = Math.round(roundedValue*roundAttr) / roundAttr;
				}
			} else {
				roundedValue = parseFloat(roundedValue).toFixed(this.decimalPrecision)
			}
		} else {
			//make sure the number still looks like a float with enough decimals
			roundedValue = parseFloat(roundedValue).toFixed(this.decimalPrecision);
		}

		return roundedValue
	},

	uninitialize : function(){
	}
});
