var gulp = require('gulp');
var concat = require('gulp-concat');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');

gulp.task('js', function () {
    gulp.src(['src/**/module.js', 'src/**/*.js'])
        .pipe(concat('app.js'))
        .pipe(ngAnnotate())
        .pipe(uglify())
        .pipe(gulp.dest('./js/'))
});

gulp.task('watch', ['js'], function() {
   gulp.watch('src/**/*.js', ['js']);
});