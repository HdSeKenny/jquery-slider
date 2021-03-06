(function ($, window, document, undefined) {

    var pluginName = 'slide',
        defaults = {
            // General settings...
            slideSpeed: 500,
            enableSwipe: true,

            // If you change class / data attribute names,
            // you will need to change related CSS files
            viewport: '.slider-viewport',
            track: '.slider-track',
            slide: '.slide',
            // Arrows
            prevArrow: '.slider-prev',
            nextArrow: '.slider-next',
            // Slider state
            atLastSlide: '.slider-end',
            atFirstSlide: '.slider-start',
            noSlide: '.no-slide',
            // Slide image classes
            imageContainerClass: '.slide-image',
            imageAsBackgroundClass: '.slide-image-background',
            imageAsBackgroundWrapperClass: '.slide-image-background-wrapper',
            // Slide background classes / data attributes
            backgroundClass: '.slide-data-background',
            backgroundZoomClass: '.slide-data-zoom-background',
            backgroundDataAttr: 'background',
            backgroundZoomDataAttr: 'zoom-background',

            // Check if we should enable single slide mode..
            // Return true to scroll only one slide or false to slide the default distance.
            // You can also set this to a boolean instead of a function.
            // By default, if any slide is wider than 30% of the viewport, single slide mode is enabled.
            isInSingleSlideMode: function ($slider) {
                var isInSingleSlideMode = false,
                    viewportWidth = $slider.find(this.viewport).width();

                $slider.find(this.slide).each(function () {
                    isInSingleSlideMode = $(this).outerWidth() / viewportWidth > .3;
                    return ! isInSingleSlideMode;
                });

                return isInSingleSlideMode;
            },

            // Slide distance used if "isInSingleSlideMode" is true.
            // Return any value supported by the jquery.scrollTo plugin:
            // https://github.com/flesler/jquery.scrollTo
            // By default this will slide 70% of the viewport.
            defaultSlideDistance: function ($slider, $viewport, $track, isNext) {
                return (isNext ? '+=' : '-=') + ($viewport.width() * .7) + 'px';
            },

            // Before callbacks...
            // Return false to cancel slide.
            onBeforeSlideNext: function ($slider) { },
            onBeforeSlidePrev: function ($slider) { },

            // After callbacks...
            onAfterSlideNext: function ($slider) { },
            onAfterSlidePrev: function ($slider) { }
        };

    function Plugin(element, options) {
        // Merge options...
        this.options = $.extend( {}, defaults, options);

        // Cache elements...
        this.$slider = $(element);
        this.$viewport = this.$slider.find(this.options.viewport);
        this.$track = this.$slider.find(this.options.track);
        this.$slides = this.$slider.find(this.options.slide);

        // Calculated values...
        this.viewportWidth = 0;
        this.slidesTotalWidth = 0;
        this.singleSlideIsWiderThanViewport = false;
        this.slidesFitInViewport = false;
        this.isInSingleSlideMode = false;
        this.noSlideClass = (this.options.noSlide).substr(1);
        this.onResize = null;
        this.isSliding = false;

        // Kickoff...
        this.init();
    }

    Plugin.prototype = {

        init: function ()  {
            this.swapSlideCoverImages();
            this.insertDataBackgrounds();
            this.registerEvents();
            this.evaluateSlider();

            // Do a recheck after 1 second
            // in case images load slowly...
            setTimeout(function () {
                this.evaluateSlider();
            }.bind(this), 1000);
        },

        swapSlideCoverImages: function () {
            this.$slider.find('img' + this.options.imageAsBackgroundClass).each(function (index, image) {
                var $image = $(image),
                    $container = $image.closest(this.options.imageContainerClass),
                    imageUrl = $image.prop('src');

                if (imageUrl) {
                    $container
                        .css('backgroundImage', 'url(' + imageUrl + ')')
                        .addClass((this.options.imageAsBackgroundWrapperClass).substr(1));
                }
            }.bind(this));
        },

        insertDataBackgrounds: function () {
            this.$slider.find(this.options.slide).each(function (index, slide) {
                var $slide = $(slide),
                    $background,
                    backgroundUrl = $slide.data(this.options.backgroundDataAttr) || $slide.data(this.options.backgroundZoomDataAttr),
                    shouldZoom = !! $slide.data(this.options.backgroundZoomDataAttr);

                if (backgroundUrl) {
                    $background = $('<div/>')
                        .addClass((this.options.backgroundClass).substr(1))
                        .css('backgroundImage', 'url(' + backgroundUrl + ')');

                    if (shouldZoom) {
                        $background.addClass((this.options.backgroundZoomClass).substr(1));
                    }

                    $slide.prepend($background);
                }
            }.bind(this));
        },

        registerEvents: function () {
            // Next arrow click...
            this.$slider.on('click', this.options.nextArrow, function (e) {
                e.preventDefault();
                this.slideTo(this.$slides, true);
            }.bind(this));

            // Prev arrow click...
            this.$slider.on('click', this.options.prevArrow, function (e) {
                e.preventDefault();
                this.slideTo($(this.$slides.get().reverse()), false);
            }.bind(this));

            if (this.options.enableSwipe) {
                // Swipe left...
                this.$slider.on('swiperight', function () {
                    this.slideTo($(this.$slides.get().reverse()), false);
                }.bind(this));

                // Swipe right...
                this.$slider.on('swipeleft', function () {
                    this.slideTo(this.$slides, true);
                }.bind(this));

                // No dragging when "swiping" with the mouse...
                this.$slider.on('dragstart', 'a, img', function (e) {
                    e.preventDefault();
                });

                // Don't follow links when swiping (IE 11 & Edge)...
                this.$slider.on('click', 'a', function (e) {
                    if (this.isSliding) {
                        e.preventDefault();
                    }
                }.bind(this));
            }

            // Window resize event...
            $(window).on('resize', function () {
                clearTimeout(this.onResize);
                this.onResize = setTimeout(function () {
                    this.evaluateSlider();
                    this.onResize = null;
                }.bind(this), 900);
            }.bind(this));
        },

        // Triggered on init
        // and on window resize.
        evaluateSlider: function () {
            this.updateSliderInfo();
            this.updateSlider();
            this.updateArrows();
        },

        updateSliderInfo: function () {
            this.viewportWidth = this.getViewportWidth();
            this.slidesTotalWidth = this.getSlidesWidth();
            this.singleSlideIsWiderThanViewport = this.isSingleSlideWiderThanViewport();
            this.slidesFitInViewport = this.checkSlidesFitInViewport();
            this.isInSingleSlideMode = this.options.isInSingleSlideMode instanceof Function
                ? this.options.isInSingleSlideMode(this.$slider)
                : this.options.isInSingleSlideMode;
        },

        updateSlider: function () {
            if (this.slidesFitInViewport || this.singleSlideIsWiderThanViewport) {
                this.$slider.addClass(this.noSlideClass);
            } else {
                this.$slider.removeClass(this.noSlideClass);
            }

            if (this.singleSlideIsWiderThanViewport) {
                this.slideTo(this.$slides, true);
            }
        },

        updateArrows: function () {
            var atLastSlide = (this.options.atLastSlide).substr(1),
                atFirstSlide = (this.options.atFirstSlide).substr(1);

            if (this.isAtLastSlide()) {
                this.$slider.addClass(atLastSlide);
            } else {
                this.$slider.removeClass(atLastSlide);
            }

            if (this.isAFirstSlide()) {
                this.$slider.addClass(atFirstSlide);
            } else {
                this.$slider.removeClass(atFirstSlide);
            }
        },

        slideTo: function ($slides, isNext) {
            if (this.isSliding || this.runBeforeCallback(isNext) === false) {
                return false;
            }

            this.isSliding = true;

            this.$viewport.scrollTo(this.getSlideToPosition($slides, isNext), this.options.slideSpeed, {
                onAfter: function () {
                    this.updateArrows();
                    this.runAfterCallback(isNext);
                    this.isSliding = false;
                }.bind(this)
            });
        },

        getSlideToPosition: function ($slides, isNext) {
            if ( ! this.isInSingleSlideMode) {
                return this.options.defaultSlideDistance(this.$slider, this.$viewport, this.$track, isNext);
            }

            var trackOffset = this.getTrackOffset(),
                halfViewportWidth = this.viewportWidth / 2,
                slideToOffset = 0,
                isPrev = ! isNext;

            $slides.each(function (index, slide) {
                var $slide = $(slide),
                    slideWidth = $slide.outerWidth(),
                    leftOffset = $slide.position().left + parseInt($slide.css("marginLeft")),
                    slideCenterPosition = leftOffset + (slideWidth / 2) - trackOffset,
                    slideCenterIsOverHalfWay = slideCenterPosition - 2 > halfViewportWidth,
                    slideCenterIsBeforeHalfWay = slideCenterPosition + 2 < halfViewportWidth;

                slideToOffset = leftOffset + ((slideWidth - this.viewportWidth) / 2); //=> Center slide

                if ( (isNext && slideCenterIsOverHalfWay) ||
                     (isPrev && slideCenterIsBeforeHalfWay) ) {
                    return false;
                }
            }.bind(this));

            return slideToOffset;
        },

        getTrackOffset: function () {
            return Math.abs(this.$track.position().left);
        },

        getViewportWidth: function () {
            return parseFloat(this.$viewport.width());
        },

        getSlidesWidth: function () {
            var width = 0;

            this.$slides.each(function () {
                width += parseFloat($(this).outerWidth(true));
            });

            return width;
        },

        checkSlidesFitInViewport: function () {
            return this.viewportWidth > this.slidesTotalWidth;
        },

        isSingleSlideWiderThanViewport: function () {
            return this.$slides.length <= 1 && this.slidesTotalWidth >= this.viewportWidth;
        },

        isAFirstSlide: function () {
            return this.getTrackOffset() - 1 <= this.getSlideOverflow(this.$slides.first());
        },

        isAtLastSlide: function () {
            var trackRemaining = this.slidesTotalWidth - this.getTrackOffset() - 1,
                slideOverflow = this.getSlideOverflow(this.$slides.last());

            return this.viewportWidth >= trackRemaining - slideOverflow;
        },

        getSlideOverflow: function ($slide) {
            if ($slide.outerWidth() <= this.viewportWidth) {
                return 0;
            }

            return ($slide.outerWidth() - this.viewportWidth) / 2;
        },

        runBeforeCallback: function (isNext) {
            var beforeCallback = isNext
                    ? this.options.onBeforeSlideNext
                    : this.options.onBeforeSlidePrev;

            if (beforeCallback instanceof Function) {
                return beforeCallback(this.$slider);
            }

            return true;
        },

        runAfterCallback: function (isNext) {
            var afterCallback = isNext
                    ? this.options.onAfterSlideNext
                    : this.options.onAfterSlidePrev;

            if (afterCallback instanceof Function) {
                afterCallback(this.$slider);
            }
        }
    };

    $.fn[pluginName] = function (options) {
        return this.each(function () {
            if ( ! $.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName,
                new Plugin(this, options));
            }
        });
    };

})(jQuery, window, document);
