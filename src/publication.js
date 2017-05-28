/*
 * @cond LICENSE
 * ######################################################################################
 * # LGPL License                                                                       #
 * #                                                                                    #
 * # This file is part of the jQuery BibJSON Publication Plugin                         #
 * # Copyright (c) 2017, Philipp Kraus (philipp.kraus@flashpixx.de)                     #
 * # This program is free software: you can redistribute it and/or modify               #
 * # it under the terms of the GNU Lesser General Public License as                     #
 * # published by the Free Software Foundation, either version 3 of the                 #
 * # License, or (at your option) any later version.                                    #
 * #                                                                                    #
 * # This program is distributed in the hope that it will be useful,                    #
 * # but WITHOUT ANY WARRANTY; without even the implied warranty of                     #
 * # MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the                      #
 * # GNU Lesser General Public License for more details.                                #
 * #                                                                                    #
 * # You should have received a copy of the GNU Lesser General Public License           #
 * # along with this program. If not, see http://www.gnu.org/licenses/                  #
 * ######################################################################################
 * @endcond
 */


"use strict";
(function() {

    var pluginname = "publication";

    // ---- jQuery initialization -------------------------------------------------------------------------------------------

    /**
     * plugin initialize
     *
     * @param options any options
     */
    jQuery.fn[pluginname] = function (options) {
        var plugin = this.data("plugin_" + pluginname);

        if (!plugin) {
            plugin = new Publication(this, jQuery.extend({}, jQuery.fn[pluginname].defaultSettings, options || {}));
            this.data("plugin_" + pluginname, plugin);
        }

        return plugin;
    };


    /**
     * default settings
     */
    jQuery.fn[pluginname].defaultSettings = {
        
        // AJAX url of the BibJSON data
        bibjson : null,
        bibtex : null,

        // CSS classes
        csshidden : "hidden",
        cssentry  : "publication",
        datafield : "bibtexid",

        // format callbacks
        callbackFormatEntry : function( po ) { return jQuery( "<li>" ); },
        callbackFormatTitle : function ( po ) { var lo = jQuery('<span class="title">'); lo.append( po.URL ? jQuery("<a>").attr("href", po.URL ).append( po.title ) : po.title ); return lo; },
        callbackFormatAuthor : function( pa ) { var lo = jQuery('<span class="author">'); lo.append( "(" + pa.map( function(po_item) { return po_item.given && po_item.family ? po_item.given + " " + po_item.family : ( po_item["literal"] ? po_item["literal"] : null ); } ).filter(function(i) { return i != null; }).join(", ") + ")" ); return lo; },
        callbackFormatBibtex : null,

        // callback for ID generator
        callbackIDGenerator : function( po_this ) { var lc_id = po_this.dom.attr("id"); if ( !lc_id ) throw new Error( "parent object needs an id attribute" ); return function(i) { return lc_id + "-" + i.replace(/[^a-z0-9\-_]|^[^a-z]+/gi, "_"); }; },

        // finish callback (is called after all data are shown)
        callbackFinish : null
    };


    // ---- plugin definition (public methods) ------------------------------------------------------------------------------

    /**
     * plugin factory
     *
     * @param po_element DOM element
     * @param po_options initialize options
     */
    function Publication (po_element, po_options) {
        this.dom = po_element;
        this.settings = po_options;
        this.bibjson = [];
        this.bibtex = "";
        
        return this.load();
    }

    Publication.prototype = {

        /**
         * load data
         * 
         * @return self reference
         */
        load : function() {
            var self = this;

            if ( self.settings.bibjson )
                jQuery.ajax({ url: self.settings.bibjson, datatype : "json" })
                      .done( function( pa_data ) { 
                          self.bibjson = {};
                          pa_data.forEach( function(i) { self.bibjson[i.id] = i;  }) 

                          if ( !self.settings.bibtex )
                              processdata( self )
                          else   
                              jQuery.get( self.settings.bibtex, "text" )
                                    .done( function(pc_data) {
                                        // we add between closing entry backet and @ an explicit linebreak for matching the regular expression
                                        self.bibtex = pc_data.replace(/\s+/g, " ").replace(/\} @/g, "}\n@");
                                        processdata( self );
                                    })
                                    .fail( function() {
                                        throw new Error( "BibTeX source [" + self.settings.bibtex + "] cannot be read" );
                                    });
                      })
                      .fail( function() {
                          throw new Error( "BibJSON source [" + self.settings.bibjson + "] cannot be read" );
                      })
            
            return this;
        },

        /**
         * adds a filter to the items
         * 
         * @param po_filter filter function (true element is shown, otherwise element is hidden)
         * @return self reference
         */
        filter : function( po_filter ) {
            var self = this;
            var lo_generator = self.settings.callbackIDGenerator( this );
            var lo_filter = po_filter && ( typeof( po_filter ) === "function" ) ? po_filter : function() { return true; } 

            Object.values(this.bibjson).forEach(function(i) {
                var lc_id = lo_generator( i.id );
                if ( !lc_id )
                    return;

                if ( lo_filter( i ) )
                    jQuery( "#" + lc_id ).removeClass( self.settings.csshidden );
                else
                    jQuery( "#" + lc_id ).addClass( self.settings.csshidden );    
            });

            return this;
        },

        /**
         * sorts the list
         * 
         * @param po_sort sorting function
         * @return self reference
         */
        sort : function( po_sort ) {
            var self = this;
            var lo_sort = po_sort && ( typeof(po_sort) === "function" )
                          ? po_sort
                          : function() { return 0; }

            this.dom.children().sort(function(i, j) { return lo_sort( self.bibjson[ jQuery(i).data( self.settings.datafield ) ], self.bibjson[ jQuery(j).data( self.settings.datafield ) ] ); }).appendTo( this.dom );
            return this;
        },

        /**
         * returns for a Bibtex key the full entry
         * 
         * @param pc_id Bibtex identifier
         * @return string with Bibtex
         */
        bibtexsource : function( pc_id ) {
            var lo_search = new RegExp( "@.+\\{" + pc_id.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") + "(.|\\s)+?(@|$)" ).exec( this.bibtex );
            if ( ( !lo_search ) || ( lo_search.length == 0 ) )
                return null;

            var lc_result = lo_search[0].slice(0, -1).trim()
            return lc_result[ lc_result.length - 1 ] != '}'
                   ? lc_result + "}"
                   : lc_result;
        }

    };


    // ---- private function ------------------------------------------------------------------------------------------------

    /**
     * process BibJSON array
     * 
     * @param po_this plugin reference
     * @param pc_filter filter string
     */
    var processdata = function ( po_this, pc_filter )
    {
        var lo_generator = typeof(po_this.settings.callbackIDGenerator) === "function"
                           ? po_this.settings.callbackIDGenerator( po_this )
                           : undefined; 

        po_this.dom.empty();
        Object.values( po_this.bibjson )

        // create list with meta-data
        .forEach(function( po_item ) {
            po_this.dom.append( format_entry( po_this, po_item, lo_generator ) ); 
        });

        if ( typeof( po_this.settings.callbackFinish ) === "function" )
            po_this.settings.callbackFinish( po_this );    
    }


    /**
     * format function for a BibJSON object
     * 
     * @param po_this plugin reference 
     * @param po_item BibJSON object
     * @param po_idgenerator generator function for CSS IDs
     * @return DOM entry
     */
    var format_entry = function ( po_this, po_item, po_idgenerator ) {
        if ( typeof(po_this.settings.callbackFormatEntry) !== "function" )
            return;

        var lo_item = po_this.settings.callbackFormatEntry( po_item );
        lo_item.attr("data-" + po_this.settings.datafield, po_item.id );

        if (po_item["type"])
            lo_item.addClass( po_item["type"].replace(/[^a-z0-9\-_]|^[^a-z]+/gi, "_") );

        if ( po_this.settings.cssentry )
            lo_item.addClass( po_this.settings.cssentry );

        if ( typeof(po_idgenerator) === "function" )
            lo_item.attr( "id", po_idgenerator( po_item.id ) );

        if ( typeof(po_this.settings.callbackFormatTitle) === "function" )
            lo_item.append( po_this.settings.callbackFormatTitle( po_item ) );

        if ( ( typeof(po_this.settings.callbackFormatAuthor) === "function" ) && ( po_item.author ) )
            lo_item.append(" ").append( po_this.settings.callbackFormatAuthor( po_item.author ) );

        if (po_this.settings.bibtex)
        {
            if ( !new RegExp( "@.+\\{" + po_item.id.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&") ).test( po_this.bibtex ) )
                throw new Error( "BibJSON ID [" + po_item.id + "] not found in BibTeX source, data sources seems not be synchronized" );

            if ( typeof(po_this.settings.callbackFormatBibtex) === "function" )
                lo_item.append(" ").append( po_this.settings.callbackFormatBibtex( po_item.id, po_this ) );
        }

        return lo_item;
    }

}(jQuery));
