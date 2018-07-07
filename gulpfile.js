let gulp = require("gulp");

gulp.task("default", function() {
    return gulp.src(['public', 'settings.json'])
        .pipe(gulp.symlink("dist"));
});
