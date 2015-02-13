/*
 * grunt-glotpress
 * https://github.com/markoheijnen/grunt-glotpress
 *
 * Copyright (c) 2014 Marko Heijnen
 * Licensed under the GPL license.
 */

'use strict';

var request = require( 'request' );

module.exports = function(grunt) {
	var api_url;

	var current_requests = 0;
	var is_done;

	grunt.registerMultiTask('glotpress_download', 'Gets translations from a GlotPress installation', function() {
		is_done = this.async();

		// Merge task-specific and/or target-specific options with these defaults.
		var options = this.options({
			domainPath: 'languages',
			url: false,
			slug: false,
			textdomain: false,
			file_format: '%domainPath%/%textdomain%-%wp_locale%.%format%',
			formats: [
				'po',
				'mo'
			],
			filter: {
				translation_sets: false,
				minimum_percentage: 30,
				waiting_strings: false
			}
		});

		if ( ! options.url || ! options.slug ) {
			grunt.fail.report("All required options aren't filled in.");
			is_done(false);
		}

		options.url        = strip_trailing_slash( options.url );
		options.domainPath = strip_trailing_slash( options.domainPath );

		api_url = options.url + '/api/projects/' + options.slug;

		if ( ! options.textdomain ) {
			options.textdomain = options.slug;
		}

		get_project_data( options );
	});


	function get_project_data( options ) {
		var request_options = {
			url: api_url,
			encoding: null
		};

		request( request_options, function(error, response, body) {
			if ( ! error && response.statusCode === 200 ) {
				var data = JSON.parse( body );
				var set, index, format;

				for ( index in data.translation_sets ) {
					set = data.translation_sets[ index ];

					if ( 0 === set.current_count ) {
						continue;
					}

					if ( options.filter.minimum_percentage > parseInt( set.percent_translated ) ) {
						continue;
					}

					for ( format in options.formats ) {
						download_translations( set, options.formats[ format ], options );
					}
				}
			}
			else {
				is_done(false);
			}
		});
	}


	function strip_trailing_slash( str ) {
		if ( str.substr(-1) === '/' ) {
			return str.substr( 0, str.length - 1 );
		}

		return str;
	}

	function download_translations( set, format, options ) {
		var url = api_url + '/' + set.locale + '/' + set.slug + '/export-translations?format=' + format;

		if ( options.filter.waiting_strings ) {
			url += '&filters[status]=all';
		}

		var info = {
			domainPath: options.domainPath,
			textdomain: options.textdomain,
			locale: set.locale,
			wp_locale: set.wp_locale,
			format: format
		};

		if ( ! info.wp_locale ) {
			info.wp_locale = info.locale;

			if ( format.indexOf('%wp_locale%') > -1 ) {
				grunt.log.writeln( "Locale " + set.locale + " doesn't have a wp_locale set." );
			}
		}

		download_file( url, build_filename( options.file_format, info ) );
	}

	function build_filename( format, data ) {
		return format.replace( /%(\w*)%/g, function(m,key) {
			return data.hasOwnProperty( key ) ? data[key] : '';
		});
	}

	function download_file( url, file ) {
		current_requests++;

		request( url, function(error, response, body) {
			if ( ! error && response.statusCode === 200 ) {
				var feedback = grunt.file.write( process.cwd() + '/' + file, body );
			}

			current_requests--;

			if ( current_requests === 0 ) {
				is_done();
			}
		});
	}

};