const moment = require('moment');

module.exports = function (value) {

	const regex = /^(?:(um|vor|nach)\s)?(\d{2,4})(?:(?:\.(\d{2})(?:\.(\d{2,4}))?)|(?:\/(\d{4})))?$/;

	let matches = regex.exec(value);

	let prefix, year, month, day, toDate,
		from, to, display;

	// no known date
	if (!matches || !matches[2]) return;

	// if reverse date format
	if (matches[2].length === 2 && matches[3].length === 2 && matches[4].length === 4) {
		year = matches[4];
		month = matches[3];
		day = matches[2];

		from = `${year}-${month}-${day}`;
		to = `${year}-${month}-${day}`;
		display = 'YYYY.MM.DD';
	}

	// normal date format
	else if (matches[2].length === 4) {
		year = matches[2];

		if (matches[3])
			month = matches[3];
		if (matches[4])
			day = matches[4];

		if (matches[1])
			prefix = matches[1];

		if (matches[5])
			toDate = matches[5];


		if (!month && !day && !prefix && !toDate) {
			from = `${year}-01-01`;
			to = `${year}-12-31`;
			display = 'YYYY';
		}
		else if (month && !day) {
			let m = moment(`${year}-${month}`, 'YYYY-MM');
			from = m.startOf('month').format('YYYY-MM-DD');
			to = m.endOf('month').format('YYYY-MM-DD');
			display = 'YYYY.MM';
		}
		else if (month && day) {
			from = `${year}-${month}-${day}`;
			to = `${year}-${month}-${day}`;
			display = 'YYYY.MM.DD';
		}
		else if (toDate) {
			from = `${year}-01-01`;
			to = `${toDate}-12-31`;
			display = 'YYYY/YYYY';
		}
		else if (prefix) {
			if (prefix === 'um') {
				from = moment(year, 'YYYY').subtract(5, 'years').startOf('year').format('YYYY-MM-DD');
				to = moment(year, 'YYYY').add(5, 'years').endOf('year').format('YYYY-MM-DD');
				display = 'around YYYY';
			}
			else if (prefix === 'vor') {
				let m = moment(year, 'YYYY');
				to = m.endOf('year').format('YYYY-MM-DD');
				from = m.subtract(10, 'years').startOf('year').format('YYYY-MM-DD');
				display = 'before YYYY';
			}
			else if (prefix === 'nach') {
				let m = moment(year, 'YYYY');
				from = m.startOf('year').format('YYYY-MM-DD');
				to = m.add(10, 'years').endOf('year').format('YYYY-MM-DD');
				display = 'after YYYY';
			}
		}
	}

	return {
		value: value,
		from: from,
		to: to,
		display: display
	};

};
