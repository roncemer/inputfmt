// roncemer/inputfmt
// Input formatting and filtering for HTML input elements
// Copyright (c) 2010-2018 Ronald B. Cemer
// All rights reserved.
// This software is released under the 3-clause BSD license.
// Please see the accompanying LICENSE for details.

(function() {
	var filteredClasses = [ 'trim', 'upper', 'lower', 'date', 'datetime', 'numeric-scale0', 'numeric-scale1', 'numeric-scale2', 'numeric-scale3', 'numeric-scale4', 'numeric-scale5', 'numeric-scale6', 'numeric-scale7', 'numeric-scale8', 'numeric-scale9', 'numeric-scale10' ];
	var filteredClassesSelector = '.'+(filteredClasses.join(', .'));

	function filterValueForElement(elem, val) {
		// Handle trimming and case transformation.
		if (elem.hasClass('trim')) {
			val = $.trim(val);
		}
		if (elem.hasClass('upper') && (!elem.hasClass('lower'))) {
			val = val.toUpperCase();
		} else if (elem.hasClass('lower') && (!elem.hasClass('upper'))) {
			val = val.toLowerCase();
		}

		// Handle date/time and date filtering.
		if (elem.hasClass('datetime')) {
			var dt = Date.parse(val);
			val = ((dt != null) ? dt.toString('yyyy-MM-dd HH:mm:ss') : '');
		} else if (elem.hasClass('date')) {
			var dt = Date.parse(val);
			val = ((dt != null) ? dt.toString('yyyy-MM-dd') : '');
		}

		// Handle numeric filtering.
		for (var scale = 0; scale <= 10; scale++) {
		if (elem.hasClass('numeric-scale'+scale)) {
				val = (Number($.trim(val)) || 0.0).toFixed(scale);
				break;
			}
		}

		return val;
	} // filterValueForElement()

	function filterElementValues(elems) {
		elems.each(function(index, obj) {
			var elem = $(obj);
			var tagName = elem.prop('tagName');
			if ((tagName === undefined) ||
				((tagName != 'INPUT') && (tagName != 'TEXTAREA'))) {
				return;
			}

			var origval = elem.val();
			var val = filterValueForElement(elem, origval);

			if (val !== origval) {
				elem.val(val);
			}
		});
	} // filterElementValues()

	function elementFocused() {
		var elem = $(this);
		setTimeout(
			function() {
				filterElementValues(elem);
				elem.select();
			},
			1
		);
	} // elementFocused()

	function elementBlurred() {
		var elem = $(this);
		setTimeout(function() { filterElementValues(elem); }, 1);
	} // elementBlurred()

	function elementChanged() {
		var elem = $(this);
		setTimeout(function() { filterElementValues(elem); }, 1);
	} // elementChanged()

	// Override the jQuery val() function, so that when an element's value is set using val(),
	// if it needs filtering/formatting, it gets done automatically.
	(function($) {
		var orig_val = $.fn.val, valDepth = 0;
		$.fn.val = function(value) {
			if (!arguments.length) {
				return orig_val.call(this);
			}

			valDepth++;
			try {
				var result = this.each(function(i, obj) {
					var elem = $(obj);
					orig_val.call(elem, value);

					// If we're not in a recursive call to val(), and this is an input or textarea element,
					// and it does NOT have the focus, and it has any of the filtered classes, filter the
					// field after setting its value.
					if ((valDepth == 1) &&
						((obj.tagName == 'INPUT') || (obj.tagName == 'TEXTAREA')) &&
						(!elem.is(':focus'))) {
						var classes = elem.attr('class');
						classes = classes ?
							classes.split(' ').filter(function(s) { return ((s != '') && (filteredClasses.indexOf(s) >= 0)); }) :
							[];
						if (classes.length > 0) {
							filterElementValues(elem);
						}
					}
				});
				valDepth--;
				return result;
			} catch (ex) {
				valDepth--;
				throw ex;
			}
		};
	})(jQuery);

	function manageFieldFeatures(elems) {
		elems.each(function(index, obj) {
			var elem = $(obj);
			var tagName = elem.prop('tagName');
			if ((tagName === undefined) ||
				((tagName != 'INPUT') && (tagName != 'TEXTAREA') && (tagName != 'PASSWORD'))) {
				return;
			}

			if ((tagName == 'INPUT') || (tagName == 'PASSWORD')) {
				elem.unbind('focus', elementFocused);
				elem.unbind('blur', elementBlurred);
				elem.unbind('change', elementChanged);
				if (!elem.hasClass('combobox-search')) {
					elem.focus(elementFocused);
					elem.blur(elementBlurred);
					elem.blur(elementChanged);
				}
			}

			if ((tagName == 'INPUT') || (tagName == 'TEXTAREA')) {
				// Enable or disable autocomplete for autocomplete inputs based on their readonly and disabled attributes.
				// Show or hide popup search icons for inputs based on their readonly and disabled attributes.
				if ((elem.attr('readonly') === undefined) && (elem.attr('disabled') === undefined)) {
					if (elem.attr('data-combobox-seq') !== undefined) {
						if (elem.hasClass('ui-autocomplete-input')) {
							elems.autocomplete('option', 'disabled', false);
						}
						elem.parent().nextAll('.popupSearchLink').show();
					} else {
						if (elem.hasClass('ui-autocomplete-input')) {
							elems.autocomplete('option', 'disabled', true);
						}
						elem.nextAll('.popupSearchLink').show();
					}
				} else {
					if (elem.attr('data-combobox-seq') !== undefined) {
						elem.parent().nextAll('.popupSearchLink').hide();
					} else {
						elem.nextAll('.popupSearchLink').hide();
					}
				}

				// Attach or detach date pickers for datetime and date inputs based on their readonly and disabled attributes.
				if (elem.hasClass('datetime') || elem.hasClass('date')) {
					if ((elem.attr('readonly') === undefined) && (elem.attr('disabled') === undefined)) {
						if (!elem.hasClass('hasDatepicker')) {
							elem.datepicker({
								dateFormat:elem.hasClass('datetime') ? 'yy-mm-dd 00:00:00' : 'yy-mm-dd',
								showOn:'button',
								buttonImage:'jax/images/calendar_19x16.png',
								buttonImageOnly:true,
								constrainInput:false
							});
						}
					} else if (elem.hasClass('hasDatepicker')) {
						elem.datepicker('destroy');
					}
				}
			}
		});
	} // manageFieldFeatures()

	// Filter existing elements, and manage their icons.
	(function() {
		var elems = $(filteredClassesSelector);
		filterElementValues(elems);
		manageFieldFeatures(elems);
	})();

	// Filter existing and future elements when their values change.
	$(document).on('change', filteredClassesSelector, function() {
		filterElementValues($(this));
	});

	// Filter future elements and manage their icons when they are added to the DOM tree.
	// Handle showing and hiding of extra UI elements for existing and future elements when their attributes change.
	(function() {
		try {
			var mutationObserver = new MutationObserver(function(mutations) {
				for (var mi = 0; mi < mutations.length; mi++) {
					var mutation = mutations[mi];
					switch (mutation.type) {
					case 'childList':
						for (var ni = 0; ni < mutation.addedNodes.length; ni++) {
							var elem = $(mutation.addedNodes[ni]);
							filterElementValues(elem);
							manageFieldFeatures(elem);
						}
						break;
					case 'attributes':
						// Look for class, readonly, or disabled attribute mutations on input or textarea elements.
						if (mutation.target &&
							mutation.target.tagName &&
							((mutation.target.tagName == 'INPUT') || (mutation.target.tagName == 'TEXTAREA'))) {
							if (mutation.attributeName == 'class') {
								// The class changed.  If one of the filtered classes was added or removed, filter the value.
								var elem = $(mutation.target);
								var oldClasses = mutation.oldValue;
								oldClasses = oldClasses ? oldClasses.split(' ').filter(function(s) { return (s != ''); }) : [];
								var newClasses = elem.attr('class');
								newClasses = newClasses ? newClasses.split(' ').filter(function(s) { return (s != ''); }) : [];
								var removedClasses = oldClasses.filter(function(s) { return (newClasses.indexOf(s) < 0); });
								var addedClasses = newClasses.filter(function(s) { return (oldClasses.indexOf(s) < 0); });
								var removedRelevantClasses = removedClasses.filter(function(s) { return (filteredClasses.indexOf(s) >= 0); });
								var addedRelevantClasses = addedClasses.filter(function(s) { return (filteredClasses.indexOf(s) >= 0); });
								if ((removedRelevantClasses.length > 0) || (addedRelevantClasses.length > 0)) {
									filterElementValues($(mutation.target));
								}
							} else if ((mutation.attributeName == 'readonly') || (mutation.attributeName == 'disabled')) {
								// The readonly or disabled attribute changed.  Manage field features such as popup
								// search icons and date picker icons.
								manageFieldFeatures($(mutation.target));
							}
						}
						break;
					}
				}
			});
			mutationObserver.observe(
				document,
				{
					attributes: true,
					childList: true,
					subtree: true,
					characterData: false,
					attributeOldValue: true,
					attributeFilter: ['class', 'readonly', 'disabled']
				}
			);
		} catch (ex) {}
	})();

	window.filterFieldsWithSpecialFeatures = function(topLevelElement) {
		var elems;
		if (topLevelElement !== undefined) {
			elems = $(filteredClassesSelector, topLevelElement);
		} else {
			elems = $(filteredClassesSelector);
		}
		filterElementValues(elems);
		manageFieldFeatures(elems);
	}
})();



// ======================
// ajaxCombobox component
// ======================


(function($) {

	// Turn a text input element (input type=text) into a combobox backed by a server-side REST search API.
	// Options: An object with the following keys:
	//     inputElement: A CSS selector, a single DOM element, or a jQuery collection containing a
	//         single DOM element for the input element which is to have the autocomplete row selector
	//         hooked to it.
	//         Required.
	//     autocompleteCommand: The autocomplete command to use for searching rows on the server.
	//         Required.
	//     idColumn: The name of the primary key/unique identifying column for the table being searched.
	//         Optional.  Defaults to 'id'.
	//     idIsString: true if the primary key/unique identifying column is a string (character) column,
	//         false if it is an integer column.
	//         Optional.  Defaults to false.
	//     altIdColumn: The name of an optional non-primary-key unique identifying column for the table being searched.
	//         When provided, this functions as a unique identifier for values entered into the search box.  This is
	//         useful for when there is a "code" or other uniquely identifying column in addition to the normal integer
	//         primary key.  If present, when a value is entered into the search box but no match is selected from the
	//         autocomplete drop-down list, this column will be searched for the entered value instead of the column
	//         named in idColumn.  This allows direct entry of the human-readable, unique identifier in order to select
	//         a row by entering its code directly.  This is triggered when the search input loses focus.
	//         Optional.  Defaults to ''.
	//     altIdIsString: true if the non-primary-key unique identifying column is a string (character) column,
	//         false if it is an integer column.
	//         Optional.  Defaults to false.
	//     minimumInputLength: The minimum number of characters the user must enter in order to be able
	//         to search rows in the table.
	//         Optional.  Defaults to 1.
	//     allowClear: true to display a clear button when the select box has a selection. The button,
	//         when clicked, resets the value of the select box back to the placeholder, thus this
	//         option is only available when selectPlaceholder is specified as a non-empty placeholder
	//         (or left at its default, non-empty placeholder string).
	//         Optional.  Defaults to false.
	//     selectPlaceholder: The placeholder text to be put into the select box if the id is zero
	//         (integer id) or empty (string id).
	//         Optional.  Defaults to 'Select an item'.
	//     notFoundMessage: The text to be put into the select box if the currently selected id is
	//         invalid, but not zero (integer id) or empty (string id).
	//         Optional.  Defaults to '*** INVALID ***'.
	//     maxRowsPerPage: The maximum number of rows to retrieve at a time from the server (rows per
	//         page).
	//         Optional.  Defaults to 100.
	//     rowFetcher: The RowFetcher instance to use for fetching rows from the server.
	//         Optional.  If not specified, this function will look for a global variable named
	//         rowFetcher and, if set, will use that; otherwise, a new instance of RowFetcher will be
	//         created automatically.
	//     rowFetcherOptionalParameters: Optional associative array of additional parameters to be
	//         added to the query string by passing in as the fourth argument to the
	//         RowFetcher::get*forId*() function.
	$.fn.ajaxCombobox = function(action) {
		if (action == 'destroy') {
			return this.each(function(idx, inputElement) {
				var origInput = $(inputElement);
				var parents = origInput.parent();
				if ((parents.length > 0) && parents.hasClass('combobox-wrapper')) {
					origInput.insertBefore(parents);
					parents.remove();
					var origstyle = origInput.attr('data-combobox-orig-style');
					if (origstyle !== undefined) {
						if (origstyle == '') {
							origInput.removeAttr('style');
						} else {
							origInput.attr('style', origInput.attr('origstyle'));
						}
						origInput.removeAttr('data-combobox-orig-style');
					}
					origInput.removeAttr('data-combobox-seq');
					origInput.removeAttr('data-idval');
					return true;
				}
		 		return false;
			});
		} // if (action == 'destroy')
		if (typeof(action) == 'object') {
			options = action;
			return this.each(function(idx, inputElement) {

				// Required parameters.
				if (typeof(options.autocompleteCommand) == 'undefined') return false;
				var autocompleteCommand = options.autocompleteCommand;

				// Optional parameters (defaulted if not specfied).
				var idColumn = (typeof(options.idColumn) != 'undefined') ? options.idColumn : 'id';
				var idIsString = (typeof(options.idIsString) != 'undefined') ? options.idIsString : false;

				var altIdColumn = (typeof(options.altIdColumn) != 'undefined') ? options.altIdColumn : '';
				var altIdIsString = (typeof(options.altIdIsString) != 'undefined') ? options.altIdIsString : false;

				var minimumInputLength = (typeof(options.minimumInputLength) != 'undefined') ? options.minimumInputLength : 1;
				var allowClear = (typeof(options.allowClear) != 'undefined') ? options.allowClear : false;
				var selectPlaceholder = (typeof(options.selectPlaceholder) != 'undefined') ? options.selectPlaceholder : 'Select an item';
				var notFoundMessage = (typeof(options.notFoundMessage) != 'undefined') ? options.notFoundMessage : '*** INVALID ***';
				var maxRowsPerPage = (typeof(options.maxRowsPerPage) != 'undefined') ? options.maxRowsPerPage : 100;
				var myRowFetcher;
				if (typeof(options.rowFetcher) != 'undefined') {
					myRowFetcher = options.rowFetcher;
				} else if (typeof(window.rowFetcher) != 'undefined') {
					myRowFetcher = window.rowFetcher;
				} else {
					myRowFetcher = new RowFetcher();
				}

				var rowFetcherOptionalParameters = (typeof(options.rowFetcherOptionalParameters) != 'undefined') ?
					options.rowFetcherOptionalParameters : null;

				var requestSeq = 0;

				function getNextRequestSeq() {
					requestSeq++;
					if (requestSeq >= 99999999) requestSeq = 0;
					return requestSeq;
				}

				function undefinedToEmpty(val) {
					if ((val === undefined) || (val === null)) return '';
					return val;
				}

				var origInput = $(inputElement);
				if (!origInput.parent().hasClass('combobox-wrapper')) origInput.wrap('<div class="combobox-wrapper"></div>');

				var url = getBaseURL()+'?command='+encodeURIComponent(autocompleteCommand);
				if (typeof fixupAJAXURL == 'function') {
					url = fixupAJAXURL(url);
				}
				if (typeof(rowFetcherOptionalParameters) == 'object') {
					for (var k in rowFetcherOptionalParameters) {
						url += '&'+encodeURIComponent(k)+'='+encodeURIComponent(rowFetcherOptionalParameters[k]);
					}
				}

				var comboboxSeq = undefinedToEmpty(origInput.attr('data-combobox-seq'));
				if (comboboxSeq == '') {
					if (window.__nextComboboxSeq__ === undefined) window.__nextComboboxSeq__ = 0;
					comboboxSeq = ++window.__nextComboboxSeq__;
					origInput.attr('data-combobox-seq', comboboxSeq);
				}

				// Restore the original CSS settings for the original input, if we saved them before.
				if (origInput.attr('data-combobox-orig-style') !== undefined) {
					origInput.attr('style', undefinedToEmpty(origInput.attr('data-combobox-orig-style')));
				}

				// Remove any old components which were inserted after the original input.
				origInput.nextAll("input.combobox-search[data-combobox-seq='"+comboboxSeq+"']").remove();
				origInput.nextAll("a.combobox-clear[data-combobox-seq='"+comboboxSeq+"']").remove();
				origInput.nextAll("a.combobox-chevron-down[data-combobox-seq='"+comboboxSeq+"']").remove();

				// Create a search input after the original input.
				var search = origInput.clone();
				search.removeAttr('data-combobox-orig-style');
				search.attr('id', '__combobox-search__'+new Date().getTime()+'-'+comboboxSeq);
				search.attr('data-combobox-seq', comboboxSeq);
				search.removeAttr('name');
				search.addClass('combobox-search');
				search.attr('tabindex', '-1');
				search.insertAfter(origInput);

				// Save the original CSS settings for the original input, if we haven't already.
				if (origInput.attr('data-combobox-orig-style') === undefined) {
					origInput.attr('data-combobox-orig-style', undefinedToEmpty(origInput.attr('style')));
				}

				// Make the original input of zero size so we won't see it, but it can still get the focus.
				// If we hide it or put it inside an invisible container, it can't receive the focus programmatically.
				// We hook its focus event below, and transfer the focus to the search component.
				origInput.css('width', '0px');
				origInput.css('height', '0px');
				origInput.css('border', 'none');
				origInput.css('margin', '0px');
				origInput.css('padding', '0px');

				var clearLink = null;
				if (allowClear) {
					clearLink = $('<a class="btn-default combobox-clear" href="#" onclick="return false;" tabindex="-1"><i class="glyphicon glyphicon-remove-circle"></i></a>');
					clearLink.attr('data-combobox-seq', comboboxSeq);
					clearLink.insertAfter(search);
					clearLink.click(function(evt) {
						if ((!origInput.is('[readonly]')) && (!origInput.is('[disabled]'))) {
							origInput.val(idIsString ? '' : '0').trigger('change');
						}
						if (!origInput.is('[disabled]')) origInput.focus();
					});
				}

				var chevronDownLink = $('<a class="btn-default combobox-chevron-down" href="#" onclick="return false;" tabindex="-1"><i class="glyphicon glyphicon-chevron-down"></i></a>');
				chevronDownLink.insertAfter(allowClear ? clearLink : search);
				chevronDownLink.attr('data-combobox-seq', comboboxSeq);

				function isClearLinkVisible() {
					if (!allowClear) return false;
					var display = clearLink.css('display');
					return ((display == undefined) || (display != 'none'));
				}

				function getIdValue() {
					var idval = origInput.val();
					if (!idIsString) {
						var idvalint = parseInt($.trim(idval)) || 0;
						// Fix incorrectly formatted integer values.
						var idvalstr = ''+idvalint;
						if (idvalstr != idval) origInput.val(idvalstr).trigger('change');
						if (idvalint == 0) {
							if (allowClear && isClearLinkVisible()) {
								clearLink.hide();
								search.removeClass('has-clear');
							}
							return null;
						}
					} else {
						if (idval == '') {
							if (allowClear && isClearLinkVisible()) {
								clearLink.hide();
								search.removeClass('has-clear');
							}
							return null;
						}
					}
					if (allowClear) {
						if ((!origInput.is('[readonly]')) && (!origInput.is('[disabled]'))) {
							if (!isClearLinkVisible()) {
								clearLink.show();
								search.addClass('has-clear');
							}
						} else {
							if (isClearLinkVisible()) {
								clearLink.hide();
								search.removeClass('has-clear');
							}
						}
					}
					return idval;
				}

				function setLabel(label) {
      				search.val(label).trigger('change');
					search.attr('data-current-label', label);
					search.removeAttr('data-manually-entered');
				}

				var suppressNextLabelLookup = false;

				function origInputChanged() {
					var idval = getIdValue();
					origInput.attr('data-idval', idval);
					if (idval === null) {
       					setLabel(selectPlaceholder);
					} else {
						if (suppressNextLabelLookup) {
							suppressNextLabelLookup = false;
						} else {
							var myRequestSeq = getNextRequestSeq();
							function rowFetcherCallback(row, textStatus, jqXHR) {
								// Prevent race conditions.  The last request to be issued wins.
								if (requestSeq != myRequestSeq) return;
								if (row !== null) {
       								setLabel(row.label);
								} else {
       								setLabel(notFoundMessage);
								}
							}
							if (idIsString) {
								myRowFetcher.getRowForIdString(
									rowFetcherCallback,
									autocompleteCommand,
									idColumn,
									idval
								);
							} else {
								myRowFetcher.getRowForId(
									rowFetcherCallback,
									autocompleteCommand,
									idColumn,
									idval
								);
							}
						}
					}
				}

				function trackReadonlyDisabledState() {
					var oreadonly = origInput.is('[readonly]');
					var odisabled = origInput.is('[disabled]');
					var sreadonly = search.is('[readonly]');
					var sdisabled = search.is('[disabled]');

					if (sreadonly != oreadonly) {
						if (oreadonly) search.attr('readonly', true); else search.removeAttr('readonly');
					}
					if (sdisabled != odisabled) {
						if (odisabled) search.attr('disabled', true); else search.removeAttr('disabled');
					}
					getIdValue();
				}

				try {
					var mutationObserver = new MutationObserver(function(mutations) {
						if (!$.contains(document, search[0])) {
							mutationObserver.disconnect();
							return;
						}
						trackReadonlyDisabledState();
					});
					mutationObserver.observe(origInput[0], { attributes: true, childList: false, characterData: false });
				} catch (ex) {}

				origInput.focus(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					search.addClass('active');
					trackReadonlyDisabledState();
				});
				origInput.blur(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					if (typeof(origInput.attr('data-transferring-focus')) != 'undefined') {
						origInput.removeAttr('data-transferring-focus');
					}
					search.removeClass('active');
					trackReadonlyDisabledState();
				});
				origInput.keypress(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					if ((!origInput.is('[readonly]')) && (!origInput.is('[disabled]'))) {
						origInput.attr('data-transferring-focus', true);
						search.val(String.fromCharCode(evt.which)).trigger('change');
						search.attr('data-manually-entered', true);
						search.focus();
					}
					evt.preventDefault();
					evt.defaultPrevented = true;
					trackReadonlyDisabledState();
					return false;
				});
				origInput.change(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					origInputChanged();
					trackReadonlyDisabledState();
				});
				origInput.on('lookupDescription', function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					origInputChanged();
					trackReadonlyDisabledState();
				});

				search.focus(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					search.removeClass('active');
					trackReadonlyDisabledState();
				});
				search.blur(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					var oldval = search.val();
					var isManuallyEntered = (typeof(search.attr('data-manually-entered')) != 'undefined');
					if (isManuallyEntered) search.removeAttr('data-manually-entered');
					if ((oldval != '') && isManuallyEntered) {
						// If we lose focus on the search input when its value is not empty, try to find
						// the row by alternate id or by id.
						if (altIdColumn != '') {
							var myRequestSeq = getNextRequestSeq();
							function rowFetcherCallback(row, textStatus, jqXHR) {
								// Prevent race conditions.  The last request to be issued wins.
								if (requestSeq != myRequestSeq) return;
								if (row !== null) {
									suppressNextLabelLookup = true;
									origInput.val(row.value).trigger('change');
       								setLabel(row.label);
								} else {
       								setLabel(notFoundMessage);
								}
							}
							if (altIdIsString) {
								myRowFetcher.getRowForIdString(
									rowFetcherCallback,
									autocompleteCommand,
									altIdColumn,
									oldval
								)
							} else {
								myRowFetcher.getRowForId(
									rowFetcherCallback,
									autocompleteCommand,
									altIdColumn,
									oldval
								);
							}
						} else {
							origInput.val(search.val()).trigger('change');
						}
					} else {
						// If we lose focus on the search input when its value is empty, restore the current label as its value.
						search.val((typeof(search.attr('data-current-label')) != 'undefined') ? search.attr('data-current-label') : '').trigger('change');
					}
					trackReadonlyDisabledState();
				});
				search.keypress(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					// As the value in the search box changes, show or hide the clear button.
					setTimeout(getIdValue, 1);
					search.attr('data-manually-entered', true);
					trackReadonlyDisabledState();
				});
				search.mousedown(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					if (!origInput.is('[disabled]')) origInput.focus();
					evt.stopPropagation();
					return false;
				});

				chevronDownLink.mousedown(function(evt) {
					if (!$.contains(document, search[0])) {
						origInput.off(this);
						return;
					}
					if (!origInput.is('[disabled]')) origInput.focus();
					if ((!origInput.is('[readonly]')) && (!origInput.is('[disabled]'))) {
						if (search.autocomplete('widget').is(':visible')) {
							search.autocomplete('close');
						} else {
							search.autocomplete('option', 'minLength', 0);
							search.autocomplete('search', '');
							search.autocomplete('option', 'minLength', minimumInputLength);
						}
					}
					evt.stopPropagation();
					return false;
				});

				search.autocomplete({
					minLength:minimumInputLength,
   					source:url,
					autoFocus:false,
   					select:function(event, ui) {
						setLabel(ui.item.label);
       					origInput.val(ui.item.value).trigger('change');
						getIdValue();
						if (!origInput.is('[disabled]')) origInput.focus();
						trackReadonlyDisabledState();
						return false;
   					},
					focus:function(event, ui) {
						return false; 
					}
				});

				// Set up the initial state for the value in the original input.
				origInputChanged();
			});
		} // if (typeof(action) == 'object')
		return false;
	};
}(jQuery));


// ==========================
// ajaxAutocomplete component
// ==========================


(function($) {
	// Hook an autocomplete drop-down list for a related table to an input element.
	// Attach an autocomplete drop-down list, backed by a server-side REST search API, to a text input element (input type=text).
	// The input element would typically be a text input.
	// Options: An associative array, with the following keys:
	//     inputElement: A CSS selector, a single DOM element, or a jQuery collection containing a
	//         single DOM element for the input element which is to have the autocomplete row selector
	//         hooked to it.
	//         Required.
	//     autocompleteCommand: The autocomplete command to use for searching rows on the server.
	//         Required.
	//     minimumInputLength: The minimum number of characters the user must enter in order to be able
	//         to search rows in the table.
	//         Optional.  Defaults to 1.
	$.fn.ajaxAutocomplete = function(action) {
		if (action == 'destroy') {
			return this.each(function(idx, inputElement) {
				try {
					return $(inputElement).autocomplete('destroy');
				} catch (ex) {
					return false;
				}
			});
		} // if (action == 'destroy')
		if (typeof(action) == 'object') {
			options = action;
			return this.each(function(idx, inputElement) {

				// Required parameters.
				if (typeof(options.autocompleteCommand) == 'undefined') return false;
				var autocompleteCommand = options.autocompleteCommand;

				var minimumInputLength = (typeof(options.minimumInputLength) != 'undefined') ? options.minimumInputLength : 1;

				var url = getBaseURL()+'?command='+encodeURIComponent(autocompleteCommand);
				if (typeof fixupAJAXURL == 'function') {
					url = fixupAJAXURL(url);
				}
				$(inputElement).autocomplete({
					minLength:minimumInputLength,
					source:url,
					select:function(event, ui) {
						window.__lastAutocompleteField__ = $(event.target);
						setTimeout('window.__lastAutocompleteField__.change().focus().select();', 1);
					},
					focus:function(event, ui) {
						$(this).val(ui.item.value).trigger('change');
						return false; 
					}
				});
			});
		} // if (typeof(action) == 'object')
		return false;
	};
}(jQuery));
