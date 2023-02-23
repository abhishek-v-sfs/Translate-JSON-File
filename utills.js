// unflattern object
exports.unFlatternData = function (data, language) {
	const result = {};

	data.forEach((element) => {
		// split the values using .
		const keys = element.ValueRawInput.split('.');

		// reduce the values (combine)
		keys.reduce(function (r, e, j) {
			return (
				r[e] ||
				(r[e] = isNaN(Number(keys[j + 1]))
					? keys.length - 1 == j
						? language === 'French'
							? element.french
							: language === 'English'
							? element.english
							: element.spanish
						: {}
					: [])
			);
		}, result);
	});

	return result;
};

// flattern obj
function flatternObj(object, addToList, prefix) {
	Object.keys(object).map((key) => {
		if (object[key] === null) {
			addToList[prefix + key] = '';
		} else if (object[key] instanceof Array) {
			for (i in object[key]) {
				flatternObj(object[key][i], addToList, prefix + key + '.' + i);
			}
		} else if (typeof object[key] == 'object' && !object[key].toLocaleDateString) {
			flatternObj(object[key], addToList, prefix + key + '.');
		} else {
			addToList[prefix + key] = object[key];
		}
	});
	return addToList;
}
exports.flatten = flatternObj;
