const gulp = require('gulp');
const concat = require('gulp-concat');
const ngAnnotate = require('gulp-ng-annotate');
const uglify = require('gulp-uglify');

function js() {
    return gulp.src(['src/**/module.js', 'src/**/*.js'])
        .pipe(concat('app.js'))
        .pipe(ngAnnotate())
        .pipe(uglify())
        .pipe(gulp.dest('./js/'));
}

function watch() {
    return gulp.watch('src/**/*.js', js);
}

// Export tasks
exports.js = js;
exports.watch = gulp.series(js, watch);
exports.default = js;